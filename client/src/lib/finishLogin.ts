import type { AuthTokens } from "../types/auth";
import { getPendingCartItem } from "./cartIntent";

// Persist tokens and send the user on. If they came from "Add to cart",
// land them on the cart so the pending item is added (see useCartIntent).
export function finishLogin(tokens: AuthTokens) {
    localStorage.setItem("accessToken", tokens.accessToken);
    localStorage.setItem("refreshToken", tokens.refreshToken);
    window.location.href = getPendingCartItem() ? "/cart" : "/dashboard";
}
