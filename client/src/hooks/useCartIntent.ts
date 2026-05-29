import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { useAddToCart } from "./useCart";
import { getPendingCartItem, clearPendingCartItem } from "../lib/cartIntent";

/**
 * Consumes a pending "add to cart" intent saved by a guest before logging in.
 * Runs once after the app loads: if the user is now a logged-in buyer and an
 * intent exists, it adds the item to the cart. The login flow already lands the
 * user on /cart (see useLogin / AuthCallback), so this only does the add.
 */
export function useCartIntent() {
    const { user } = useAuth();
    const addToCart = useAddToCart();
    const handled = useRef(false);

    useEffect(() => {
        if (handled.current) return;

        const pending = getPendingCartItem();
        if (!pending) return;

        // Not a buyer (guest or admin) — can't fulfil the intent; drop it.
        if (!user || !user.roles.includes("BUYER")) {
            if (user) clearPendingCartItem();
            return;
        }

        handled.current = true;
        clearPendingCartItem();

        addToCart.mutate(pending);
    }, [user, addToCart]);
}
