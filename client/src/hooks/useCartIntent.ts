import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import { useAddToCart } from "./useCart";
import { getPendingCartItem, clearPendingCartItem } from "../lib/cartIntent";

/**
 * Consumes a pending "add to cart" intent saved by a guest before logging in.
 * Runs once after the app loads: if the user is now a logged-in buyer and an
 * intent exists, it adds the item to the cart and redirects to /cart.
 */
export function useCartIntent() {
    const { user } = useAuth();
    const addToCart = useAddToCart();
    const navigate = useNavigate();
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

        addToCart.mutate(pending, {
            // Whether it succeeds or it's already in the cart (409), send the
            // user to the cart so they see the result either way.
            onSettled: () => navigate("/cart"),
        });
    }, [user, addToCart, navigate]);
}
