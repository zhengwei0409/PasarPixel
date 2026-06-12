import type { Currency } from "./asset";

export interface DashboardStats {
    totalUsers: number;
    totalAssets: number;
    totalRevenue: number;
    // The currency totalRevenue is expressed in (backend normalises to USD).
    // The dashboard converts from this into the admin's display currency.
    revenueCurrency: Currency;
    pendingItems: number;
}
