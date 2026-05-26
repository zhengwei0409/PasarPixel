import axios from "axios";
import apiClient from "../lib/apiClient";
import type {
    Asset,
    AssetFile,
    AssetWithFileCount,
    AssetWithFiles,
    CreateAssetPayload,
    GetUploadUrlPayload,
    GetUploadUrlResponse,
    RegisterFilePayload,
} from "../types/asset";

export async function createAsset(payload: CreateAssetPayload): Promise<Asset> {
    const res = await apiClient.post<Asset>("/assets", payload);
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
