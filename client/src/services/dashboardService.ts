import apiClient from "../lib/apiClient";
import type { DashboardStats } from "../types/dashboard";

export async function getDashboardStats(): Promise<DashboardStats> {
    const res = await apiClient.get<DashboardStats>("/admin/stats");
    return res.data;
}
