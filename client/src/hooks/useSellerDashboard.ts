import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getSellerDashboard,
    getSellerRecentOrders,
    getWithdrawals,
    requestWithdrawal,
} from "../services/sellerService";

export function useSellerDashboard() {
    return useQuery({
        queryKey: ["seller", "dashboard"],
        queryFn: () => getSellerDashboard(),
    });
}

export function useWithdrawals() {
    return useQuery({
        queryKey: ["seller", "withdrawals"],
        queryFn: () => getWithdrawals(),
    });
}

export function useRequestWithdrawal() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (amount: number) => requestWithdrawal(amount),
        onSuccess: () => {
            // Refresh both the withdrawal list and the dashboard balance.
            queryClient.invalidateQueries({ queryKey: ["seller", "withdrawals"] });
            queryClient.invalidateQueries({ queryKey: ["seller", "dashboard"] });
        },
    });
}

export function useSellerRecentOrders() {
    return useQuery({
        queryKey: ["seller", "recent-orders"],
        queryFn: getSellerRecentOrders,
    });
}
