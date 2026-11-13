import { useQuery } from "@tanstack/react-query";
import type { AdminTransactionFilters, AdminTransactionsResponse } from "../../../shared/types/adminTransaction";
import apiClient from "../lib/apiClient";

export function useAdminTransactions(filters: AdminTransactionFilters) {
    return useQuery({
        queryKey: ["adminTransactions", filters],
        queryFn: async ({ signal }) => {
            const { data } = await apiClient.get<AdminTransactionsResponse>("/admin/transactions", { params: filters, signal });
            return data;
        },
    });
}
