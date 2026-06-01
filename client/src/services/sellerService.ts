import apiClient from "../lib/apiClient";
import type {
    SellerDashboard,
    Withdrawal,
    WithdrawalsResponse,
} from "../types/seller";

export async function getSellerDashboard(): Promise<SellerDashboard> {
    const res = await apiClient.get<SellerDashboard>("/seller/dashboard");
    return res.data;
}

export async function getWithdrawals(): Promise<WithdrawalsResponse> {
    const res = await apiClient.get<WithdrawalsResponse>("/seller/withdrawals");
    return res.data;
}

export async function requestWithdrawal(
    amount: number,
): Promise<{ withdrawal: Withdrawal; availableBalance: number }> {
    const res = await apiClient.post("/seller/withdrawals", { amount });
    return res.data;
}
