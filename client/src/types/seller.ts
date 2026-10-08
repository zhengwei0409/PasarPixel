import type { Currency } from "./asset";
import type { LicenseType } from "./cart";
import type { PaymentStatus } from "./order";

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
    availableBalance: number;
}

export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

export interface Withdrawal {
    id: number;
    sellerId: number;
    amount: string; // Prisma Decimal serialised as string
    status: WithdrawalStatus;
    createdAt: string;
    updatedAt: string;
}

export interface WithdrawalsResponse {
    withdrawals: Withdrawal[];
    availableBalance: number;
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
}

export interface SellerRecentOrdersResponse {
    items: SellerRecentOrder[];
}
