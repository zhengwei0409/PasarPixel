import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type MasterNft } from "../../generated/client";
import { HttpError } from "../lib/errors";
import { masterMetadata, mintAuthorization, type MintSource } from "../lib/masterMetadata";
import { MintBuildError, type MintGateway } from "../lib/coreMint";
import { verifyWalletSignature } from "../lib/walletSignature";

export interface MintOptions { mainApiUrl: string; publicApiUrl: string; clientOrigin: string; gateway?: MintGateway }
export function masterDto(master: MasterNft | null) {
    return master ? { assetId: master.assetId, assetAddress: master.assetAddress, ownerAddress: master.ownerAddress,
        status: master.status, metadataUri: master.metadataUri || null, txSignature: master.txSignature, error: master.errorMessage,
        explorerUrl: `https://explorer.solana.com/address/${master.assetAddress}?cluster=devnet`,
        authorization: master.status === "AWAITING_SIGNATURE" ? { id: master.authorizationId, message: master.authorizationMessage,
            expiresAt: master.authorizationExpiresAt } : null } : null;
}

export function masterMintService(db: PrismaClient, options: MintOptions) {
    const { gateway } = options;
    async function source(assetId: number, authorization: string): Promise<MintSource> {
        const response = await fetch(`${options.mainApiUrl}/assets/${assetId}/mint-snapshot`, { method: "POST", headers: { authorization }, signal: AbortSignal.timeout(120_000) });
        if ([401, 403, 404, 409].includes(response.status)) throw new HttpError(response.status, "Only your approved, available blockchain listings can be minted");
        if (!response.ok) throw new HttpError(503, "Unable to prepare the listing snapshot. Please try again.");
        const data = await response.json();
        if (data.assetId !== assetId || !/^[a-f0-9]{64}$/.test(data.manifestHash)) throw new Error("Invalid mint snapshot response");
        return data;
    }
    async function serial<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
        for (let attempt = 0; ; attempt++) {
            try { return await db.$transaction(work, { isolationLevel: "Serializable" }); }
            catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code) && attempt < 3) continue;
                throw error;
            }
        }
    }
    async function owned(userId: number, assetId: number) {
        const master = await db.masterNft.findUnique({ where: { assetId }, include: { ownerWallet: { select: { userId: true } } } });
        if (master && master.ownerWallet.userId !== userId) throw new HttpError(404, "Master NFT not found");
        return master;
    }
    return {
        async status(userId: number, assetId: number) { return { enabled: Boolean(gateway), master: masterDto(await owned(userId, assetId)) }; },
        async prepare(userId: number, assetId: number, authorization: string) {
            if (!gateway) throw new HttpError(503, "NFT minting is currently unavailable. Please try again later.");
            // Verify ownership before creating a record which could reserve another seller's listing ID.
            const eligible = await fetch(`${options.mainApiUrl}/assets/${assetId}/mint-eligibility`, { signal: AbortSignal.timeout(10_000) });
            if (!eligible.ok || (await eligible.json()).sellerId !== userId) throw new HttpError(409, "Only your approved, available blockchain listings can be minted");
            const leaseToken = randomUUID();
            const record = await serial(async tx => {
                const wallet = await tx.wallet.findUnique({ where: { userId } });
                if (!wallet) throw new HttpError(409, "Bind your Phantom wallet in Settings before minting");
                let master = await tx.masterNft.findUnique({ where: { assetId } });
                if (master && master.ownerWalletId !== wallet.id) throw new HttpError(404, "Master NFT not found");
                if (master && (master.status === "READY" || master.status === "PENDING" ||
                    (master.leaseUntil && master.leaseUntil > new Date()) ||
                    (master.status === "AWAITING_SIGNATURE" && master.authorizationExpiresAt! > new Date()))) return master;
                if (!master) {
                    const mintReference = randomUUID();
                    master = await tx.masterNft.create({ data: { ownerWalletId: wallet.id, ownerAddress: wallet.address, assetId, mintReference,
                        assetAddress: gateway.assetAddress(mintReference), metadataUri: "" } });
                }
                return tx.masterNft.update({ where: { id: master.id }, data: { status: "PREPARING", ownerAddress: wallet.address,
                    authorizedAt: null, authorizationId: null, authorizationMessage: null, authorizationExpiresAt: null, errorMessage: null,
                    leaseToken, leaseUntil: new Date(Date.now() + 180_000) } });
            });
            if (record.leaseToken !== leaseToken) return { enabled: true, master: masterDto(record) };
            try {
                const snapshot = await source(assetId, authorization);
                if (snapshot.sellerId !== userId) throw new HttpError(403, "Listing owner does not match");
                const metadata = masterMetadata(snapshot, record.ownerAddress);
                await db.nftMetadata.upsert({ where: { hash: metadata.hash }, create: { hash: metadata.hash, body: metadata.body }, update: {} });
                const metadataUri = `${options.publicApiUrl}/blockchain/metadata/${metadata.hash}`;
                if (Buffer.byteLength(metadataUri) > 200) throw new HttpError(503, "The platform metadata URL is too long for minting");
                const approval = mintAuthorization(options.clientOrigin, record.assetAddress, record.ownerAddress, metadataUri);
                const changed = await db.masterNft.updateMany({ where: { id: record.id, leaseToken, status: "PREPARING" }, data: {
                    name: metadata.name, metadataUri, manifestHash: snapshot.manifestHash, status: "AWAITING_SIGNATURE", leaseToken: null, leaseUntil: null,
                    authorizationId: approval.authorizationId, authorizationMessage: approval.message, authorizationExpiresAt: approval.expiresAt } });
                if (!changed.count) throw new HttpError(409, "Mint preparation changed. Please try again.");
                return { enabled: true, master: masterDto(await owned(userId, assetId)) };
            } catch (error) {
                await db.masterNft.updateMany({ where: { id: record.id, leaseToken }, data: { status: "FAILED", leaseToken: null, leaseUntil: null,
                    errorMessage: error instanceof HttpError ? error.message : "Unable to prepare the NFT snapshot. Please try again." } });
                throw error;
            }
        },
        async authorize(userId: number, assetId: number, id: unknown, signature: unknown, authorization: string) {
            if (!gateway) throw new HttpError(503, "NFT minting is currently unavailable");
            const record = await owned(userId, assetId);
            if (!record || record.status !== "AWAITING_SIGNATURE" || record.authorizationId !== id || !record.authorizationExpiresAt ||
                record.authorizationExpiresAt <= new Date() || !record.authorizationMessage ||
                !verifyWalletSignature(record.ownerAddress, record.authorizationMessage, signature)) throw new HttpError(400, "Mint authorization expired or could not be verified. Please try again.");
            const snapshot = await source(assetId, String(authorization));
            if (snapshot.sellerId !== userId || snapshot.manifestHash !== record.manifestHash) throw new HttpError(409, "Listing snapshot changed");
            await serial(async tx => {
                const wallet = await tx.wallet.findUnique({ where: { userId } });
                if (wallet?.address !== record.ownerAddress) throw new HttpError(409, "Your bound wallet changed");
                const updated = await tx.masterNft.updateMany({ where: { id: record.id, status: "AWAITING_SIGNATURE", authorizationId: String(id), authorizationExpiresAt: { gt: new Date() } },
                    data: { status: "PENDING", authorizedAt: new Date(), authorizationMessage: null } });
                if (!updated.count) throw new HttpError(409, "Mint authorization was already used");
            });
            return { enabled: true, master: masterDto(await owned(userId, assetId)) };
        },
        async tick() {
            if (!gateway) return;
            await db.masterNft.updateMany({ where: { status: "AWAITING_SIGNATURE", authorizationExpiresAt: { lte: new Date() } },
                data: { status: "FAILED", authorizationMessage: null, errorMessage: "Mint approval expired. Please try again." } });
            await db.masterNft.updateMany({ where: { status: "PREPARING", leaseUntil: { lt: new Date() } },
                data: { status: "FAILED", leaseToken: null, leaseUntil: null, errorMessage: "Mint preparation was interrupted. Please try again." } });
            const records = await db.masterNft.findMany({ where: { status: "PENDING", OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, take: 5, orderBy: { id: "asc" } });
            for (const record of records) {
                const leaseToken = randomUUID();
                const claim = await db.masterNft.updateMany({ where: { id: record.id, status: "PENDING", OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] },
                    data: { leaseToken, leaseUntil: new Date(Date.now() + 120_000) } });
                if (!claim.count) continue;
                const update = (data: Prisma.MasterNftUpdateManyMutationInput) => db.masterNft.updateMany({ where: { id: record.id, leaseToken }, data });
                try {
                    let attempt = await db.masterMintAttempt.findFirst({ where: { masterNftId: record.id, status: "PENDING" }, orderBy: { id: "desc" } });
                    if (!attempt) {
                        if (!record.authorizedAt || !record.authorizationExpiresAt || record.authorizationExpiresAt <= new Date()) throw new MintBuildError("Mint approval expired. Please try again.");
                        const eligible = await fetch(`${options.mainApiUrl}/assets/${record.assetId}/mint-eligibility`, { signal: AbortSignal.timeout(10_000) });
                        if (!eligible.ok || (await eligible.json()).sellerId !== (await db.wallet.findUniqueOrThrow({ where: { id: record.ownerWalletId } })).userId) {
                            throw new MintBuildError("Listing is no longer available for minting");
                        }
                        const signed = await gateway.build(record, record.mintReference);
                        // Persist signed bytes and signature BEFORE broadcasting. A crashed worker
                        // can recover and rebroadcast exactly the same transaction.
                        attempt = await db.$transaction(async tx => {
                            const held = await tx.masterNft.updateMany({ where: { id: record.id, leaseToken, status: "PENDING" }, data: { txSignature: signed.signature } });
                            if (!held.count) throw new Error("Mint lease lost");
                            return tx.masterMintAttempt.create({ data: { masterNftId: record.id, ...signed, transaction: Buffer.from(signed.transaction) } });
                        });
                    }
                    const state = await gateway.reconcile(record, attempt);
                    if (state === "PENDING") {
                        // A send error is UNKNOWN, never a reason to sign a second mint.
                        await gateway.send(attempt.transaction);
                    } else {
                        await db.$transaction(async tx => {
                            const changed = await tx.masterNft.updateMany({ where: { id: record.id, leaseToken },
                                data: { status: state, errorMessage: state === "FAILED" ? "The mint transaction failed or expired. Please try again." : null } });
                            if (changed.count) await tx.masterMintAttempt.update({ where: { id: attempt!.id }, data: { status: state === "READY" ? "CONFIRMED" : "FAILED" } });
                        });
                    }
                } catch (error) {
                    if (error instanceof MintBuildError && !await db.masterMintAttempt.findFirst({ where: { masterNftId: record.id, status: "PENDING" } })) {
                        await update({ status: "FAILED", errorMessage: error.message });
                    }
                    // RPC/network errors remain PENDING and are retried by the worker.
                    console.warn("Master mint worker will reconcile", { assetId: record.assetId,
                        reason: error instanceof MintBuildError ? "pre-send validation failed" : "RPC or verification unavailable" });
                } finally { await update({ leaseUntil: null, leaseToken: null }); }
            }
        },
    };
}
