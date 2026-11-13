import apiClient from "../lib/apiClient";
import type {
    SellerDashboard,
    SellerRecentOrdersResponse,
    SellerStripeStatus,
} from "../types/seller";

export async function getSellerDashboard(): Promise<SellerDashboard> {
    const res = await apiClient.get<SellerDashboard>("/seller/dashboard");
    return res.data;
}

export async function getSellerStripeStatus(): Promise<SellerStripeStatus> {
    const { data } = await apiClient.get<{ status: SellerStripeStatus }>("/seller/stripe/status");
    return data.status;
}

export async function startSellerStripeOnboarding(): Promise<string> {
    const { data } = await apiClient.post<{ url: string }>("/seller/stripe/onboarding");
    return data.url;
}

export async function getSellerRecentOrders(): Promise<SellerRecentOrdersResponse> {
    const res = await apiClient.get<SellerRecentOrdersResponse>("/seller/orders");
    return res.data;
}
