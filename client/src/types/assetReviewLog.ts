export type AssetReviewAction = "APPROVE" | "REJECT";

export interface AssetReviewLogAdmin {
    userId: number;
    name: string | null;
    email: string | null;
}

export interface AssetReviewLogAsset {
    id: number;
    title: string | null;
}

export interface AssetReviewLog {
    id: number;
    action: AssetReviewAction;
    reason: string | null;
    createdAt: string;
    asset: AssetReviewLogAsset;
    admin: AssetReviewLogAdmin;
}
