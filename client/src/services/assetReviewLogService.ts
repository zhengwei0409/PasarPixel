import apiClient from "../lib/apiClient";
import type { AssetReviewLog } from "../types/assetReviewLog";

export async function getAssetReviewLogs(): Promise<AssetReviewLog[]> {
    const res = await apiClient.get<AssetReviewLog[]>("/logs/asset-reviews");
    return res.data;
}
