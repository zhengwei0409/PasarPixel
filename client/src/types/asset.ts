export type AssetCategory =
    | "THREE_D_MODEL"
    | "IMAGE"
    | "VIDEO"
    | "SOUND_EFFECT"
    | "FONT"
    | "ANIMATION";

export type ListingType = "TRADITIONAL" | "BLOCKCHAIN";

export type AssetStatus =
    | "DRAFT"
    | "PENDING_REVIEW"
    | "PUBLISHED"
    | "REJECTED"
    | "TAKEN_DOWN";

export interface Asset {
    id: number;
    sellerId: number;
    title: string;
    description: string | null;
    category: AssetCategory;
    listingType: ListingType;
    status: AssetStatus;
    pricePersonal: string | null;
    priceCommercial: string | null;
    isAiGenerated: boolean;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AssetFile {
    id: number;
    assetId: number;
    fileType: string;
    fileUrl: string;
    fileSize: number;
    createdAt: string;
}

export interface AssetWithFiles extends Asset {
    files: AssetFile[];
}

export interface AssetWithFileCount extends Asset {
    _count: { files: number };
}

export interface CreateAssetPayload {
    title: string;
    description?: string;
    category: AssetCategory;
    listingType: ListingType;
    isAiGenerated?: boolean;
}

export interface GetUploadUrlPayload {
    fileName: string;
    fileType: string;
    fileSize: number;
}

export interface GetUploadUrlResponse {
    uploadUrl: string;
    key: string;
    expiresIn: number;
}

export interface RegisterFilePayload {
    key: string;
    fileType: string;
    fileSize: number;
}
