import type { Currency } from "./asset";
import type { LicenseType } from "./cart";
import type { PaymentStatus } from "./order";

export type SellerStripeStatus = "not_connected" | "needs_onboarding" | "ready" | "unavailable";

export interface RevenuePoint {
    month: string; // "YYYY-MM"
    revenue: number;
}

export interface SellerDashboard {
    revenue: number;
    salesCount: number;
    productCount: number;
    pendingReviewCount: number;
    productsByStatus: Record<string, number>;
    revenueSeries: RevenuePoint[];
    solRevenueLamports?: string;
    solCommissionLamports?: string;
    solSalesCount?: number;
}

export interface SellerRecentOrder {
    id: number;
    orderId: number;
    product: string;
    buyerName: string;
    licenseType: LicenseType;
    amount: string;
    currency: Currency;
    paymentStatus: PaymentStatus;
    createdAt: string;
    paymentMethod?: "STRIPE" | "SOL";
    priceLamports?: string | null;
    commissionLamports?: string | null;
}

export interface SellerRecentOrdersResponse {
    items: SellerRecentOrder[];
}
