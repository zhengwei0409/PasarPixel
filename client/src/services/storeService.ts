import axios from "axios";
import apiClient from "../lib/apiClient";
import type {
    Store,
    StoreAssetsResponse,
    StoreImageKind,
    StoreImageUploadUrlPayload,
    StoreImageUploadUrlResponse,
    UpdateStorePayload,
} from "../types/store";

export async function getStore(sellerId: number): Promise<Store> {
    const res = await apiClient.get<Store>(`/stores/${sellerId}`);
    return res.data;
}

export async function getStoreAssets(sellerId: number): Promise<StoreAssetsResponse> {
    const res = await apiClient.get<StoreAssetsResponse>(`/stores/${sellerId}/assets`);
    return res.data;
}

export async function getMyStore(): Promise<Store> {
    const res = await apiClient.get<Store>("/stores/me");
    return res.data;
}

export async function updateMyStore(payload: UpdateStorePayload): Promise<Store> {
    const res = await apiClient.patch<Store>("/stores/me", payload);
    return res.data;
}

export async function getStoreImageUploadUrl(
    kind: StoreImageKind,
    payload: StoreImageUploadUrlPayload,
): Promise<StoreImageUploadUrlResponse> {
    const res = await apiClient.post<StoreImageUploadUrlResponse>(
        `/stores/me/${kind}/upload-url`,
        payload,
    );
    return res.data;
}

export async function uploadStoreImageToS3(uploadUrl: string, file: File): Promise<void> {
    await axios.put(uploadUrl, file, {
        headers: { "Content-Type": file.type },
    });
}

export async function setStoreImage(kind: StoreImageKind, key: string): Promise<Store> {
    const res = await apiClient.patch<Store>(`/stores/me/${kind}`, { key });
    return res.data;
}
