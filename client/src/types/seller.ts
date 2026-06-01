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
