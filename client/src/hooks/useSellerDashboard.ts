import { useQuery } from "@tanstack/react-query";
import { getSellerDashboard } from "../services/sellerService";

export function useSellerDashboard() {
    return useQuery({
        queryKey: ["seller", "dashboard"],
        queryFn: () => getSellerDashboard(),
    });
}
