import { useQuery } from "@tanstack/react-query";
import {
    getSellerDashboard,
    getSellerRecentOrders,
} from "../services/sellerService";

export function useSellerDashboard() {
    return useQuery({
        queryKey: ["seller", "dashboard"],
        queryFn: () => getSellerDashboard(),
    });
}

export function useSellerRecentOrders() {
    return useQuery({
        queryKey: ["seller", "recent-orders"],
        queryFn: getSellerRecentOrders,
    });
}
