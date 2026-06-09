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

export type AssetFilePurpose = "ORIGINAL" | "PREVIEW";

export interface AssetFile {
    id: number;
    assetId: number;
    fileType: string;
    fileUrl: string;
    previewUrl: string | null;
    fileSize: number;
    purpose: AssetFilePurpose;
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

// Full detail an admin sees when reviewing one asset (see getAssetForReview).
export interface AssetReviewDetail extends AssetWithFiles {
    seller: {
        userId: number;
        name: string;
        email: string | null;
        bio: string | null;
        avatarUrl: string | null;
    };
    store: {
        storeName: string;
        reason: string;
        portfolioLink: string | null;
    } | null;
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
    purpose?: AssetFilePurpose;
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
    purpose?: AssetFilePurpose;
}

// Seller shape on public asset responses. `store` carries the shop's display
// name + logo; null only for legacy assets whose seller has no store yet.
export interface AssetSeller {
    userId: number;
    name: string;
    avatarUrl: string | null;
    store: { storeName: string; logoUrl: string | null } | null;
}

export interface BrowseAssetItem extends AssetWithFiles {
    seller: AssetSeller;
    averageRating: number;
    reviewCount: number;
}

export interface Review {
    id: number;
    userId: number;
    assetId: number;
    rating: number;
    comment: string | null;
    createdAt: string;
    user: { userId: number; name: string; avatarUrl: string | null };
}

export interface AssetReviewsResponse {
    items: Review[];
    averageRating: number;
    count: number;
}

export interface SubmitReviewPayload {
    rating: number;
    comment?: string;
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
