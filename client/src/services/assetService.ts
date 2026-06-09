import axios from "axios";
import apiClient from "../lib/apiClient";
import type {
    Asset,
    AssetFile,
    AssetWithFileCount,
    AssetWithFiles,
    AssetWithSeller,
    AssetReviewDetail,
    BrowseAssetItem,
    BrowseAssetsParams,
    BrowseAssetsResponse,
    CreateAssetPayload,
    GetUploadUrlPayload,
    GetUploadUrlResponse,
    RegisterFilePayload,
    UpdateAssetPayload,
    AssetReviewsResponse,
    Review,
    SubmitReviewPayload,
} from "../types/asset";

export async function createAsset(payload: CreateAssetPayload): Promise<Asset> {
    const res = await apiClient.post<Asset>("/assets", payload);
    return res.data;
}

export async function updateAsset(assetId: number, payload: UpdateAssetPayload): Promise<Asset> {
    const res = await apiClient.patch<Asset>(`/assets/${assetId}`, payload);
    return res.data;
}

export async function getAsset(assetId: number): Promise<AssetWithFiles> {
    const res = await apiClient.get<AssetWithFiles>(`/assets/${assetId}`);
    return res.data;
}

export async function getMyAssets(): Promise<AssetWithFileCount[]> {
    const res = await apiClient.get<AssetWithFileCount[]>("/assets/mine");
    return res.data;
}

export async function getUploadUrl(
    assetId: number,
    payload: GetUploadUrlPayload,
): Promise<GetUploadUrlResponse> {
    const res = await apiClient.post<GetUploadUrlResponse>(
        `/assets/${assetId}/upload-url`,
        payload,
    );
    return res.data;
}

export async function uploadToS3(
    uploadUrl: string,
    file: File,
    onProgress?: (percent: number) => void,
): Promise<void> {
    await axios.put(uploadUrl, file, {
        headers: { "Content-Type": file.type },
        onUploadProgress: (e) => {
            if (onProgress && e.total) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        },
    });
}

export async function registerFile(
    assetId: number,
    payload: RegisterFilePayload,
): Promise<AssetFile> {
    const res = await apiClient.post<AssetFile>(`/assets/${assetId}/files`, payload);
    return res.data;
}

export async function deleteFile(assetId: number, fileId: number): Promise<void> {
    await apiClient.delete(`/assets/${assetId}/files/${fileId}`);
}

export async function submitForReview(assetId: number): Promise<Asset> {
    const res = await apiClient.post<Asset>(`/assets/${assetId}/submit`);
    return res.data;
}

export async function getPendingReviewAssets(): Promise<AssetWithSeller[]> {
    const res = await apiClient.get<AssetWithSeller[]>("/assets/pending-review");
    return res.data;
}

export async function getAssetForReview(assetId: number): Promise<AssetReviewDetail> {
    const res = await apiClient.get<AssetReviewDetail>(`/assets/${assetId}/review`);
    return res.data;
}

export async function getAssetFileDownloadUrl(
    assetId: number,
    fileId: number,
): Promise<string> {
    const res = await apiClient.get<{ downloadUrl: string }>(
        `/assets/${assetId}/files/${fileId}/download-url`,
    );
    return res.data.downloadUrl;
}

export async function approveAsset(assetId: number): Promise<Asset> {
    const res = await apiClient.patch<Asset>(`/assets/${assetId}/approve`);
    return res.data;
}

export async function rejectAsset(assetId: number, reason: string): Promise<Asset> {
    const res = await apiClient.patch<Asset>(`/assets/${assetId}/reject`, { reason });
    return res.data;
}

export async function deleteAsset(assetId: number): Promise<Asset | null> {
    const res = await apiClient.delete<Asset>(`/assets/${assetId}`);
    return res.status === 204 ? null : res.data;
}

export async function cancelSubmission(assetId: number): Promise<Asset> {
    const res = await apiClient.post<Asset>(`/assets/${assetId}/cancel-submission`);
    return res.data;
}

export async function reopenRejected(assetId: number): Promise<Asset> {
    const res = await apiClient.post<Asset>(`/assets/${assetId}/reopen`);
    return res.data;
}

export async function browseAssets(params: BrowseAssetsParams = {}): Promise<BrowseAssetsResponse> {
    const res = await apiClient.get<BrowseAssetsResponse>("/assets/browse", { params });
    return res.data;
}

export async function getPublicAsset(assetId: number): Promise<BrowseAssetItem> {
    const res = await apiClient.get<BrowseAssetItem>(`/assets/browse/${assetId}`);
    return res.data;
}

export async function getRelatedAssets(assetId: number): Promise<BrowseAssetsResponse> {
    const res = await apiClient.get<BrowseAssetsResponse>(`/assets/browse/${assetId}/related`);
    return res.data;
}

export async function getAssetReviews(assetId: number): Promise<AssetReviewsResponse> {
    const res = await apiClient.get<AssetReviewsResponse>(`/assets/${assetId}/reviews`);
    return res.data;
}

export async function submitReview(
    assetId: number,
    payload: SubmitReviewPayload,
): Promise<Review> {
    const res = await apiClient.post<Review>(`/assets/${assetId}/reviews`, payload);
    return res.data;
}

export async function deleteReview(assetId: number): Promise<void> {
    await apiClient.delete(`/assets/${assetId}/reviews`);
}
