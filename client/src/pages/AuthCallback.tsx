import { useEffect } from "react";
import { getPendingCartItem } from "../lib/cartIntent";

export default function AuthCallback() {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get('accessToken');
        const refreshToken = params.get('refreshToken');

        if (accessToken && refreshToken) {
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            // Land on the cart if the user was mid "Add to cart" (see useCartIntent).
            window.location.href = getPendingCartItem() ? '/cart' : '/dashboard';
        } else {
            window.location.href = '/login';
        }
    }, []);

    return <div>Logging you in...</div>
}