export type SolTier = "PERSONAL" | "COMMERCIAL";
export interface SolPurchase {
    id: string; status: "PREPARING" | "AWAITING_SIGNATURE" | "PENDING" | "CONFIRMED" | "FAILED";
    licenseType: SolTier; buyerAddress: string; sellerAddress: string; priceLamports: string; commissionLamports: string;
    revision: string; programId: string; sponsorAddress: string; treasuryAddress: string; listingAddress: string;
    receiptAddress: string; assetAddress: string; metadataUri: string; metadataHash: string; termsHash: string;
    transaction: string | null; expiresAt: string | null; error: string | null; orderId: number | null; explorerUrl: string;
}
export interface SolTerms { version: string; title: string; clauses: string[]; hash: string }
export interface SolOffer {
    enabled: boolean; reason?: string; personal?: string; commercial?: string; masterAssetAddress?: string;
    terms?: Record<SolTier, SolTerms>; purchases?: SolPurchase[];
}
export interface SolPurchaseResponse { enabled: boolean; purchase: SolPurchase }
