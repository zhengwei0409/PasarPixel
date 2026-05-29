import { useMutation } from "@tanstack/react-query";
import { login } from "../services/authService";
import { getPendingCartItem } from "../lib/cartIntent";

export function useLogin() {
    return useMutation({
        mutationFn: login,
        onSuccess: (tokens) => {
            localStorage.setItem("accessToken", tokens.accessToken);
            localStorage.setItem("refreshToken", tokens.refreshToken);
            // If the user came here from "Add to cart", land them on the cart
            // so the pending item is added there (see useCartIntent).
            window.location.href = getPendingCartItem() ? "/cart" : "/dashboard";
        },
    });
}
