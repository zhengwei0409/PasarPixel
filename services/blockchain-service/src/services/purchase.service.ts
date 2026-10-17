import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type PurchaseIntent } from "@pasarpixel/blockchain-client";
import { licenseTerms, TERMS_VERSION, type BlockchainTier } from "../../../../shared/utils/licenseTerms";
import { HttpError } from "../lib/errors";
import { contentHash } from "../lib/masterMetadata";
import { PurchaseBuildError, type PurchaseGateway } from "../lib/purchaseGateway";
import type { PurchaseRecord } from "../lib/purchaseProtocol";

export interface PurchaseOptions { gateway?: PurchaseGateway; mainApiUrl: string; publicApiUrl: string; internalToken?: string }
const asChain = (p: PurchaseIntent): PurchaseRecord => ({ ...p, priceLamports: BigInt(p.priceLamports), commissionLamports: BigInt(p.commissionLamports) });
const terms = (tier: BlockchainTier) => { const body = JSON.stringify(licenseTerms(tier)); return { body, hash: contentHash(body), ...licenseTerms(tier) }; };

export function purchaseService(db: PrismaClient, options: PurchaseOptions) {
    const gateway = options.gateway;
    const dto = (p: PurchaseIntent | null) => p ? {
        id: p.id, status: p.status, licenseType: p.licenseType, buyerAddress: p.buyerAddress, sellerAddress: p.sellerAddress,
        priceLamports: p.priceLamports, commissionLamports: p.commissionLamports, revision: p.revision.toString(),
        programId: gateway?.programId, sponsorAddress: gateway?.sponsorAddress, treasuryAddress: gateway?.treasuryAddress,
        listingAddress: p.listingAddress, receiptAddress: p.receiptAddress, assetAddress: p.assetAddress,
        metadataUri: p.metadataUri, metadataHash: p.metadataHash, termsHash: p.termsHash, termsUri: p.termsUri, expiresAt: p.expiresAt,
        transaction: p.status === "AWAITING_SIGNATURE" ? Buffer.from(p.preparedTransaction!).toString("base64") : null,
        lastValidBlockHeight: p.lastValidBlockHeight?.toString(), txSignature: p.txSignature, error: p.errorMessage,
        orderId: p.mainOrderId, explorerUrl: `https://explorer.solana.com/address/${p.assetAddress}?cluster=devnet`,
    } : null;
    async function internal(path: string, init: RequestInit = {}) {
        const token = options.internalToken || process.env.INTERNAL_SERVICE_TOKEN;
        if (!token || token.length < 32) throw new HttpError(503, "Purchase service is not configured");
        const response = await fetch(`${options.mainApiUrl}${path}`, { ...init, headers: { ...init.headers, "x-internal-token": token }, signal: AbortSignal.timeout(30_000) });
        if (!response.ok) throw new HttpError(503, "Unable to verify the listing or fulfill the purchase. Please try again.");
        return response.json();
    }
    async function serial<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
        for (let i = 0; ; i++) {
            try { return await db.$transaction(work, { isolationLevel: "Serializable" }); }
            catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code) && i < 3) continue;
                throw error;
            }
        }
    }
    const master = (assetId: number) => db.masterNft.findUnique({ where: { assetId }, include: { ownerWallet: true } });
    async function listing(m: NonNullable<Awaited<ReturnType<typeof master>>>) {
        const source = await internal(`/assets/${m.assetId}/purchase-source`);
        const valid = source.available && source.assetId === m.assetId && source.sellerId === m.ownerWallet.userId && source.manifestHash === m.manifestHash;
        const state = { master: m.assetAddress, seller: m.ownerAddress, manifestHash: m.manifestHash,
            personal: valid ? BigInt(source.personal) : 0n, commercial: valid ? BigInt(source.commercial) : 0n, active: Boolean(valid) };
        return { source, state };
    }
    async function owned(userId: number, id: string) {
        if (!/^[a-f0-9-]{36}$/.test(id)) throw new HttpError(404, "Purchase not found");
        const p = await db.purchaseIntent.findUnique({ where: { id }, include: { buyerWallet: true, sellerWallet: true, masterNft: true } });
        if (!p || p.buyerWallet.userId !== userId) throw new HttpError(404, "Purchase not found");
        return p;
    }
    const response = (p: PurchaseIntent | null) => ({ enabled: Boolean(gateway), purchase: dto(p) });
    const service = {
        async offer(userId: number, assetId: number) {
            const m = await master(assetId);
            if (!m || m.status !== "READY") return { enabled: false, reason: "The seller's Master NFT is not ready." };
            if (!gateway) return { enabled: false, reason: "SOL checkout is currently unavailable." };
            const { state } = await listing(m);
            const wallet = await db.wallet.findUnique({ where: { userId } });
            const existing = wallet ? await db.purchaseIntent.findMany({ where: { masterNftId: m.id, buyerWalletId: wallet.id } }) : [];
            return { enabled: state.active, personal: state.personal.toString(), commercial: state.commercial.toString(),
                masterAssetAddress: m.assetAddress, terms: { PERSONAL: terms("PERSONAL"), COMMERCIAL: terms("COMMERCIAL") },
                purchases: existing.map(dto) };
        },
        async status(userId: number, id: string) { return response(await owned(userId, id)); },
        async prepare(userId: number, assetId: number, inputTier: unknown, acceptedTermsHash: unknown) {
            if (!gateway) throw new HttpError(503, "SOL checkout is currently unavailable");
            if (inputTier !== "PERSONAL" && inputTier !== "COMMERCIAL") throw new HttpError(400, "Choose a valid license tier");
            const tier = inputTier;
            const agreement = terms(tier);
            if (acceptedTermsHash !== agreement.hash) throw new HttpError(400, "Read and accept the current license terms before purchasing");
            const m = await master(assetId);
            if (!m || m.status !== "READY") throw new HttpError(409, "The seller's Master NFT is not ready");
            if (m.ownerWallet.userId === userId) throw new HttpError(409, "You cannot buy your own listing");
            const { source, state } = await listing(m);
            const price = tier === "PERSONAL" ? state.personal : state.commercial;
            if (!state.active || price <= 0n) throw new HttpError(409, "This listing or license tier is unavailable");
            const leaseToken = randomUUID();
            const p = await serial(async tx => {
                const wallet = await tx.wallet.findUnique({ where: { userId } });
                if (!wallet) throw new HttpError(409, "Bind your Phantom wallet in Settings before buying with SOL");
                let row = await tx.purchaseIntent.findUnique({ where: { buyerWalletId_masterNftId_licenseType: { buyerWalletId: wallet.id, masterNftId: m.id, licenseType: tier } } });
                if (row && (["PENDING", "CONFIRMED"].includes(row.status) || (row.leaseUntil && row.leaseUntil > new Date()) ||
                    (row.status === "AWAITING_SIGNATURE" && row.expiresAt! > new Date()
                        && row.priceLamports === price.toString() && row.termsHash === agreement.hash))) return row;
                if (!row) {
                    const id = randomUUID();
                    const addresses = gateway.addresses(m.assetAddress, wallet.address, tier === "PERSONAL" ? 0 : 1);
                    row = await tx.purchaseIntent.create({ data: { id, masterNftId: m.id, buyerWalletId: wallet.id, sellerWalletId: m.ownerWalletId,
                        licenseType: tier, buyerAddress: wallet.address, sellerAddress: m.ownerAddress, priceLamports: price.toString(),
                        commissionLamports: (price * 500n / 10_000n).toString(), revision: 0n, listingAddress: addresses.listing, receiptAddress: addresses.receipt,
                        assetAddress: gateway.assetAddress(id), manifestHash: m.manifestHash } });
                }
                // Only definitively failed/unsigned operations reach this path.
                // A wallet with no NFT or pending payment may have been rebound.
                const addresses = gateway.addresses(m.assetAddress, wallet.address, tier === "PERSONAL" ? 0 : 1);
                return tx.purchaseIntent.update({ where: { id: row.id }, data: { status: "PREPARING", errorMessage: null,
                    buyerAddress: wallet.address, receiptAddress: addresses.receipt, listingAddress: addresses.listing,
                    preparedTransaction: null, txSignature: null, priceLamports: price.toString(), commissionLamports: (price * 500n / 10_000n).toString(),
                    leaseToken, leaseUntil: new Date(Date.now() + 180_000) } });
            });
            if (p.leaseToken !== leaseToken) return response(p);
            try {
                const revision = await gateway.syncListing(state);
                const name = Array.from(`${source.title} · ${tier === "PERSONAL" ? "Personal" : "Commercial"}`).slice(0, 32).join("");
                const termsUri = `${options.publicApiUrl}/blockchain/metadata/${agreement.hash}`;
                const body = JSON.stringify({ name, symbol: "PASAR", image: source.logoUri, description: "PasarPixel usage License NFT. Copyright remains with the seller.",
                    schemaVersion: 1, masterAssetAddress: m.assetAddress, buyerWallet: p.buyerAddress, sellerWallet: p.sellerAddress, licenseType: tier,
                    termsVersion: TERMS_VERSION, termsUri, termsHash: agreement.hash, contentManifestHash: m.manifestHash, purchaseRef: p.id,
                    attributes: [{ trait_type: "NFT type", value: "License" }, { trait_type: "License", value: tier }],
                    properties: { category: "image", files: [{ uri: source.logoUri, type: "image/png" }] } });
                const metadataHash = contentHash(body);
                const metadataUri = `${options.publicApiUrl}/blockchain/metadata/${metadataHash}`;
                if (Buffer.byteLength(metadataUri) > 200) throw new PurchaseBuildError("Platform metadata URL is too long");
                await db.nftMetadata.upsert({ where: { hash: agreement.hash }, create: { hash: agreement.hash, body: agreement.body }, update: {} });
                await db.nftMetadata.upsert({ where: { hash: metadataHash }, create: { hash: metadataHash, body }, update: {} });
                const details = { revision, name, metadataHash, metadataUri, termsHash: agreement.hash, termsUri, termsVersion: TERMS_VERSION,
                    expiresAt: new Date(Date.now() + 90_000) };
                const draft = await gateway.build(asChain({ ...p, ...details }));
                const changed = await db.purchaseIntent.updateMany({ where: { id: p.id, leaseToken, status: "PREPARING" }, data: { ...details,
                    preparedTransaction: Buffer.from(draft.transaction), lastValidBlockHeight: draft.lastValidBlockHeight,
                    status: "AWAITING_SIGNATURE", leaseToken: null, leaseUntil: null } });
                if (!changed.count) throw new HttpError(409, "Purchase preparation changed. Please try again.");
                return response(await db.purchaseIntent.findUniqueOrThrow({ where: { id: p.id } }));
            } catch (error) {
                await db.purchaseIntent.updateMany({ where: { id: p.id, leaseToken }, data: { status: "FAILED", leaseToken: null, leaseUntil: null,
                    errorMessage: error instanceof PurchaseBuildError ? error.message : "Unable to prepare the purchase. Please try again." } });
                throw error instanceof PurchaseBuildError ? new HttpError(409, error.message) : error;
            }
        },
        async submit(userId: number, id: string, encoded: unknown) {
            if (!gateway) throw new HttpError(503, "SOL checkout is currently unavailable");
            const p = await owned(userId, id);
            if (["PENDING", "CONFIRMED"].includes(p.status)) return response(p);
            if (p.status !== "AWAITING_SIGNATURE" || !p.preparedTransaction || !p.expiresAt || p.expiresAt <= new Date()) throw new HttpError(409, "Purchase quote expired; request a new quote");
            if (typeof encoded !== "string" || encoded.length > 1700 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new HttpError(400, "Invalid signed purchase transaction");
            const m = await master(p.masterNft.assetId);
            const { state } = await listing(m!);
            const revision = await gateway.syncListing(state);
            if (!state.active || revision !== p.revision) {
                await db.purchaseIntent.updateMany({ where: { id, status: "AWAITING_SIGNATURE" }, data: { status: "FAILED", preparedTransaction: null, errorMessage: "The listing changed. Please request a new quote." } });
                throw new HttpError(409, "The listing changed. Please request a new quote.");
            }
            let signed;
            try { signed = await gateway.sign(asChain(p), p.preparedTransaction, Buffer.from(encoded, "base64")); }
            catch (error) { throw new HttpError(400, error instanceof PurchaseBuildError ? error.message : "Invalid buyer signature"); }
            await serial(async tx => {
                const wallet = await tx.wallet.findUnique({ where: { userId } });
                if (wallet?.address !== p.buyerAddress) throw new HttpError(409, "The bound buyer wallet changed");
                const changed = await tx.purchaseIntent.updateMany({ where: { id, status: "AWAITING_SIGNATURE", expiresAt: { gt: new Date() } },
                    data: { status: "PENDING", txSignature: signed.signature, preparedTransaction: null } });
                if (!changed.count) throw new HttpError(409, "Purchase was already submitted or expired");
                await tx.purchaseAttempt.create({ data: { purchaseId: id, signature: signed.signature, transaction: Buffer.from(signed.transaction), lastValidBlockHeight: p.lastValidBlockHeight! } });
            });
            return response(await owned(userId, id));
        },
        async proof(id: string) {
            const p = await db.purchaseIntent.findUnique({ where: { id }, include: { masterNft: true, buyerWallet: true, sellerWallet: true, attempts: { orderBy: { id: "desc" }, take: 1 } } });
            if (!gateway || !p || p.status !== "CONFIRMED" || !p.attempts[0]) throw new HttpError(409, "Purchase is not finalized");
            if (p.buyerWallet.address !== p.buyerAddress) throw new HttpError(503, "Purchase wallet binding does not match the receipt");
            if (await gateway.reconcile(asChain(p), p.masterNft.assetAddress, p.attempts[0]) !== "CONFIRMED") throw new HttpError(503, "Unable to verify the finalized receipt");
            const metadata = await db.nftMetadata.findUnique({ where: { hash: p.metadataHash } });
            const agreement = await db.nftMetadata.findUnique({ where: { hash: p.termsHash } });
            if (!metadata || contentHash(metadata.body) !== p.metadataHash || !agreement || contentHash(agreement.body) !== p.termsHash) {
                throw new HttpError(503, "Immutable purchase metadata could not be verified");
            }
            return { purchaseRef: p.id, status: p.status, assetId: p.masterNft.assetId, buyerId: p.buyerWallet.userId, sellerId: p.sellerWallet.userId,
                buyerAddress: p.buyerAddress, sellerAddress: p.sellerAddress, assetAddress: p.assetAddress, masterAssetAddress: p.masterNft.assetAddress,
                receiptAddress: p.receiptAddress, priceLamports: p.priceLamports, commissionLamports: p.commissionLamports, txSignature: p.txSignature,
                metadataUri: p.metadataUri, licenseType: p.licenseType, termsVersion: p.termsVersion, termsUri: p.termsUri, termsHash: p.termsHash, manifestHash: p.manifestHash };
        },
        async tick() {
            await db.purchaseIntent.updateMany({ where: { status: "AWAITING_SIGNATURE", expiresAt: { lte: new Date() } }, data: { status: "FAILED", preparedTransaction: null, errorMessage: "Purchase quote expired. Please try again." } });
            await db.purchaseIntent.updateMany({ where: { status: "PREPARING", leaseUntil: { lt: new Date() } }, data: { status: "FAILED", leaseToken: null, leaseUntil: null, errorMessage: "Purchase preparation was interrupted. Please try again." } });
            if (!gateway) return;
            const records = await db.purchaseIntent.findMany({ where: { OR: [{ status: "PENDING" }, { status: "CONFIRMED", mainOrderId: null }],
                AND: { OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] } }, take: 5, orderBy: { createdAt: "asc" }, include: { masterNft: true } });
            for (const p of records) {
                const leaseToken = randomUUID();
                const held = await db.purchaseIntent.updateMany({ where: { id: p.id, status: p.status, txSignature: p.txSignature,
                    mainOrderId: p.mainOrderId, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] },
                    data: { leaseToken, leaseUntil: new Date(Date.now() + 180_000) } });
                if (!held.count) continue;
                try {
                    const attempt = await db.purchaseAttempt.findFirstOrThrow({ where: { purchaseId: p.id }, orderBy: { id: "desc" } });
                    const state = await gateway.reconcile(asChain(p), p.masterNft.assetAddress, attempt);
                    if (state === "PENDING") { await gateway.send(attempt.transaction); continue; }
                    await db.$transaction(async tx => {
                        const changed = await tx.purchaseIntent.updateMany({ where: { id: p.id, leaseToken }, data: { status: state,
                            errorMessage: state === "FAILED" ? "The transaction failed or expired. Please try again." : null } });
                        if (changed.count) await tx.purchaseAttempt.update({ where: { id: attempt.id }, data: { status: state === "CONFIRMED" ? "CONFIRMED" : "FAILED" } });
                    });
                    if (state !== "CONFIRMED") continue;
                    const order = await internal(`/internal/blockchain/fulfill/${p.id}`, { method: "POST" });
                    await db.$transaction(async tx => {
                        const changed = await tx.purchaseIntent.updateMany({ where: { id: p.id, leaseToken }, data: { mainOrderId: order.orderId, mainOrderItemId: order.orderItemId } });
                        if (!changed.count) return;
                        const license = await tx.licenseNft.upsert({ where: { orderItemId: order.orderItemId }, update: {}, create: {
                            masterNftId: p.masterNftId, holderWalletId: p.buyerWalletId, orderItemId: order.orderItemId,
                            mintAddress: p.assetAddress, metadataUri: p.metadataUri, licenseType: p.licenseType } });
                        await tx.blockchainTransaction.upsert({ where: { licenseNftId: license.id }, update: {}, create: { licenseNftId: license.id,
                            sellerWalletId: p.sellerWalletId, buyerWalletId: p.buyerWalletId, txSignature: attempt.signature, status: "CONFIRMED" } });
                    });
                } catch { console.warn("Purchase reconciliation will retry", { purchaseRef: p.id }); }
                finally { await db.purchaseIntent.updateMany({ where: { id: p.id, leaseToken }, data: { leaseToken: null, leaseUntil: null } }); }
            }
            // Reconcile moderation and prices onto the chain; a pause takes effect
            // once its listing-update transaction is finalized.
            for (const m of await db.masterNft.findMany({ where: { status: "READY" }, include: { ownerWallet: true } })) {
                try { const { state } = await listing(m); await gateway.syncListing(state); }
                catch { console.warn("On-chain listing synchronization will retry", { assetId: m.assetId }); }
            }
        },
    };
    return service;
}
