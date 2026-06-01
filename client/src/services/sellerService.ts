import apiClient from "../lib/apiClient";
import type { SellerDashboard } from "../types/seller";

export async function getSellerDashboard(): Promise<SellerDashboard> {
    const res = await apiClient.get<SellerDashboard>("/seller/dashboard");
    return res.data;
}
