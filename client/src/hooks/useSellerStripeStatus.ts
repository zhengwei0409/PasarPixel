import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { getSellerStripeStatus } from "../services/sellerService";

export function useSellerStripeStatus() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ["seller", user?.sub, "stripe-status"],
        queryFn: getSellerStripeStatus,
        enabled: Boolean(user?.roles.includes("SELLER")),
        refetchOnMount: "always",
        refetchOnWindowFocus: "always",
    });
}
