export type AssetCategory =
    | "THREE_D_MODEL"
    | "IMAGE"
    | "VIDEO"
    | "SOUND_EFFECT"
    | "FONT"
    | "ANIMATION";

export type ListingType = "TRADITIONAL" | "BLOCKCHAIN";

export type Currency = "USD" | "MYR";

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
    currency: Currency;
    priceSol: string | null;
    isAiGenerated: boolean;
    isDeleted: boolean;
    rejectionReason: string | null;
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

export interface AssetWithSeller extends AssetWithFileCount {
    seller: { userId: number; name: string; email: string | null };
}

export interface CreateAssetPayload {
    title: string;
    description?: string;
    category: AssetCategory;
    listingType: ListingType;
    isAiGenerated?: boolean;
    pricePersonal?: number | null;
    priceCommercial?: number | null;
    priceSol?: number | null;
    currency?: Currency;
}

export interface UpdateAssetPayload {
    title?: string;
    description?: string;
    category?: AssetCategory;
    listingType?: ListingType;
    isAiGenerated?: boolean;
    pricePersonal?: number | null;
    priceCommercial?: number | null;
    priceSol?: number | null;
    currency?: Currency;
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

export interface BrowseAssetItem extends AssetWithFiles {
    seller: { userId: number; name: string; avatarUrl: string | null };
}

export type BrowseSort = "newest" | "price_asc" | "price_desc";

export interface BrowseAssetsParams {
    page?: number;
    pageSize?: number;
    sort?: BrowseSort;
    category?: AssetCategory;
    listingType?: ListingType;
    isAiGenerated?: boolean;
    minPrice?: number;
    maxPrice?: number;
    keyword?: string;
}

export interface BrowseAssetsResponse {
    items: BrowseAssetItem[];
    total: number;
    page: number;
    pageSize: number;
}
