import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "../services/dashboardService";

export function useDashboardStats() {
    return useQuery({
        queryKey: ["dashboardStats"],
        queryFn: getDashboardStats,
    });
}
