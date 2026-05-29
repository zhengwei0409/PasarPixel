import type { BrowseAssetItem } from "./asset";

export type LicenseType = "PERSONAL" | "COMMERCIAL";

export interface CartItem {
    id: number;
    userId: number;
    assetId: number;
    licenseType: LicenseType;
    createdAt: string;
}

export interface CartItemWithAsset extends CartItem {
    asset: BrowseAssetItem;
}

export interface CartResponse {
    items: CartItemWithAsset[];
}

export interface AddToCartPayload {
    assetId: number;
    licenseType: LicenseType;
}
