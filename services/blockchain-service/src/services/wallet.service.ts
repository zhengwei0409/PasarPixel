import { Prisma, PrismaClient } from "../../generated/client";
import { HttpError } from "../lib/errors";
import { createChallengeMessage, parseWalletAddress, verifyWalletSignature } from "../lib/walletSignature";

type WalletDb = Prisma.TransactionClient;

async function readWallet(db: WalletDb, userId: number) {
    const wallet = await db.wallet.findUnique({
        where: { userId },
        include: {
            _count: { select: { masterNfts: true, licenseNfts: true } },
            sellerTransactions: { where: { status: "PENDING" }, take: 1, select: { id: true } },
            buyerTransactions: { where: { status: "PENDING" }, take: 1, select: { id: true } },
        },
    });
    const lockedReason = wallet && (wallet._count.masterNfts || wallet._count.licenseNfts)
        ? "NFT_OWNERSHIP"
        : wallet && (wallet.sellerTransactions.length || wallet.buyerTransactions.length)
            ? "PENDING_TRANSACTION" : null;
    return {
        network: "solana:devnet" as const,
        wallet: wallet ? {
            address: wallet.address, verifiedAt: wallet.verifiedAt,
            createdAt: wallet.createdAt, updatedAt: wallet.updatedAt,
        } : null,
        canChange: lockedReason === null,
        lockedReason,
    };
}

// Serializable transactions make challenge consumption + binding a single operation.
// All future mint / purchase operations must also coordinate wallet binding changes.
async function serializable<T>(db: PrismaClient, work: (tx: WalletDb) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await db.$transaction(work, { isolationLevel: "Serializable" });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2034" && attempt < 3) continue;
                if (error.code === "P2034") throw new HttpError(409, "Wallet changed during verification. Please try again.");
                if (error.code === "P2002") throw new HttpError(409, "This wallet is already bound or another binding is in progress");
            }
            throw error;
        }
    }
}

export function walletService(db: PrismaClient, origin: string) {
    return {
        getStatus: (userId: number) => readWallet(db, userId),
        async createChallenge(userId: number, input: unknown) {
            const address = parseWalletAddress(input);
            return serializable(db, async (tx) => {
                const status = await readWallet(tx, userId);
                if (!status.canChange && status.wallet?.address !== address) {
                    throw new HttpError(409, "This account's wallet cannot change while it owns NFTs or has pending transactions");
                }
                const owner = await tx.wallet.findUnique({ where: { address }, select: { userId: true } });
                if (owner && owner.userId !== userId) throw new HttpError(409, "This wallet is already bound to another account");
                const { message, expiresAt } = createChallengeMessage(origin, userId, address, new Date());
                const data = { address, message, expiresAt, consumedAt: null, createdAt: new Date() };
                // Rotate the challenge ID as well, so an earlier prompt cannot consume a newer challenge.
                await tx.walletChallenge.deleteMany({ where: { userId } });
                const challenge = await tx.walletChallenge.create({ data: { userId, ...data } });
                return { challengeId: challenge.id, address, message, expiresAt, network: "solana:devnet" };
            });
        },
        async bind(userId: number, challengeId: unknown, signature: unknown) {
            if (typeof challengeId !== "string" || !/^[a-z0-9]{20,40}$/.test(challengeId)) {
                throw new HttpError(400, "Invalid wallet challenge");
            }
            return serializable(db, async (tx) => {
                const challenge = await tx.walletChallenge.findUnique({ where: { userId } });
                if (!challenge || challenge.id !== challengeId || challenge.consumedAt || challenge.expiresAt <= new Date()) {
                    throw new HttpError(400, "Wallet challenge expired or was already used. Please try again.");
                }
                if (!verifyWalletSignature(challenge.address, challenge.message, signature)) {
                    throw new HttpError(400, "Wallet signature could not be verified");
                }
                const status = await readWallet(tx, userId);
                if (!status.canChange && status.wallet?.address !== challenge.address) {
                    throw new HttpError(409, "This account's wallet cannot change while it owns NFTs or has pending transactions");
                }
                const consumed = await tx.walletChallenge.updateMany({
                    where: { id: challenge.id, userId, consumedAt: null, expiresAt: { gt: new Date() } },
                    data: { consumedAt: new Date() },
                });
                if (consumed.count !== 1) throw new HttpError(409, "Wallet challenge is no longer valid");
                await tx.wallet.upsert({
                    where: { userId },
                    create: { userId, address: challenge.address },
                    update: { address: challenge.address, verifiedAt: new Date() },
                });
                return readWallet(tx, userId);
            });
        },
    };
}
