import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getCart,
    addToCart,
    updateCartItemLicense,
    removeFromCart,
} from "../services/cartService";
import type { AddToCartPayload, CartItem, LicenseType } from "../types/cart";

export function useCart() {
    return useQuery({
        queryKey: ["cart"],
        queryFn: () => getCart(),
    });
}

export function useAddToCart() {
    const queryClient = useQueryClient();
    return useMutation<CartItem, Error, AddToCartPayload>({
        mutationFn: (payload) => addToCart(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cart"] });
        },
    });
}

export interface UpdateCartItemLicenseVars {
    cartItemId: number;
    licenseType: LicenseType;
}

export function useUpdateCartItemLicense() {
    const queryClient = useQueryClient();
    return useMutation<CartItem, Error, UpdateCartItemLicenseVars>({
        mutationFn: ({ cartItemId, licenseType }) =>
            updateCartItemLicense(cartItemId, licenseType),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cart"] });
        },
    });
}

export function useRemoveFromCart() {
    const queryClient = useQueryClient();
    return useMutation<void, Error, number>({
        mutationFn: (cartItemId) => removeFromCart(cartItemId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cart"] });
        },
    });
}
