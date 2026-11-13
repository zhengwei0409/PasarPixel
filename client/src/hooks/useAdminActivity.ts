import { useQuery } from "@tanstack/react-query";
import type { AdminActivityFilters, AdminActivityPage } from "../../../shared/types/adminActivityLog";
import apiClient from "../lib/apiClient";

export function useAdminActivity(filters: AdminActivityFilters, page = 1) {
    return useQuery({
        queryKey: ["adminActivity", filters, page],
        queryFn: async ({ signal }) => {
            const { data } = await apiClient.get<AdminActivityPage>("/logs/activity", { params: { ...filters, page }, signal });
            return data;
        },
    });
}
