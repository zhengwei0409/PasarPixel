import axios from "axios";
import apiClient from "../lib/apiClient";
import type {
    Asset,
    AssetFile,
    AssetWithFileCount,
    AssetWithFiles,
    AssetWithSeller,
    BrowseAssetsParams,
    BrowseAssetsResponse,
    CreateAssetPayload,
    GetUploadUrlPayload,
    GetUploadUrlResponse,
    RegisterFilePayload,
    UpdateAssetPayload,
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

export async function browseAssets(params: BrowseAssetsParams = {}): Promise<BrowseAssetsResponse> {
    const res = await apiClient.get<BrowseAssetsResponse>("/assets/browse", { params });
    return res.data;
}
