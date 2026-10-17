import { activeAccount, purchaseProof } from "./blockchain";

type EntitlementItem = { blockchainPurchaseRef: string | null; licenseAssetAddress: string | null; masterAssetAddress: string | null;
    receiptAddress: string | null; buyerWalletAddress: string | null; manifestHash: string | null; termsHash: string | null;
    accessRevokedAt: Date | null; priceLamports: string | null; commissionLamports: string | null; assetId: number; licenseType: string };

export async function solEntitlement(order: { paymentMethod: string; orderItems: EntitlementItem[] }, userId: number) {
    if (order.paymentMethod !== "SOL") return null;
    try {
        for (const item of order.orderItems) {
            if (!item.blockchainPurchaseRef) return { status: 403, error: "License ownership could not be verified", purchaseVerified: false };
            const proof = await purchaseProof(item.blockchainPurchaseRef);
            if (proof.status !== "CONFIRMED" || proof.buyerId !== userId || proof.buyerAddress !== item.buyerWalletAddress || proof.assetId !== item.assetId ||
                proof.assetAddress !== item.licenseAssetAddress || proof.masterAssetAddress !== item.masterAssetAddress || proof.receiptAddress !== item.receiptAddress || proof.licenseType !== item.licenseType ||
                proof.manifestHash !== item.manifestHash || proof.termsHash !== item.termsHash || proof.priceLamports !== item.priceLamports ||
                proof.commissionLamports !== item.commissionLamports) return { status: 403, error: "License ownership could not be verified", purchaseVerified: false };
        }
        if (order.orderItems.some(item => item.accessRevokedAt)) return { status: 403, error: "This license's download access has been revoked", purchaseVerified: true };
        if (!await activeAccount(userId, "BUYER")) return { status: 403, error: "Your account cannot access these downloads", purchaseVerified: true };
        return null;
    } catch { return { status: 503, error: "Unable to verify blockchain access. Please try again." }; }
}
