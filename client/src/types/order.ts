import type { BrowseAssetItem, Currency } from "./asset";
import type { LicenseType } from "./cart";

export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

export interface OrderItem {
    id: number;
    orderId: number;
    assetId: number;
    licenseType: LicenseType;
    price: string; // Prisma Decimal serialised as string
    licenseKey: string;
    createdAt: string;
    asset: BrowseAssetItem;
}

export interface Order {
    id: number;
    buyerId: number;
    totalAmount: string; // Prisma Decimal serialised as string
    currency: Currency; // the currency the buyer paid in
    paymentStatus: PaymentStatus;
    stripePaymentId: string | null;
    createdAt: string;
    updatedAt: string;
    orderItems: OrderItem[];
}

export interface OrdersParams {
    page?: number;
    pageSize?: number;
    paymentStatus?: PaymentStatus;
    keyword?: string;
}

export interface OrdersResponse {
    items: Order[];
    total: number;
    page: number;
    pageSize: number;
}

// FR-3.5: public licence verification result. Only non-sensitive fields — the
// backend never returns price, buyer identity, or payment details here.
export interface LicenseVerification {
    valid: boolean;
    licenseKey: string;
    licenseType: LicenseType;
    assetTitle: string;
    sellerName: string;
    purchasedAt: string;
}
