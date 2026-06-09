import type { BrowseAssetItem } from "./asset";

export interface Store {
    id: number;
    sellerId: number;
    storeName: string;
    description: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface StoreAssetsResponse {
    items: BrowseAssetItem[];
}

export interface UpdateStorePayload {
    storeName?: string;
    description?: string | null;
}

// Which shop image an upload targets — mirrors the backend `ImageKind`.
export type StoreImageKind = "logo" | "banner";

export interface StoreImageUploadUrlPayload {
    fileName: string;
    fileType: string;
    fileSize: number;
}

export interface StoreImageUploadUrlResponse {
    uploadUrl: string;
    key: string;
    expiresIn: number;
}
