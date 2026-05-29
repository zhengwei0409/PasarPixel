import apiClient from "../lib/apiClient";
import type { AddToCartPayload, CartItem, CartResponse, LicenseType } from "../types/cart";

export async function getCart(): Promise<CartResponse> {
    const res = await apiClient.get<CartResponse>("/cart");
    return res.data;
}

export async function addToCart(payload: AddToCartPayload): Promise<CartItem> {
    const res = await apiClient.post<CartItem>("/cart", payload);
    return res.data;
}

export async function updateCartItemLicense(
    cartItemId: number,
    licenseType: LicenseType,
): Promise<CartItem> {
    const res = await apiClient.patch<CartItem>(`/cart/${cartItemId}`, { licenseType });
    return res.data;
}

export async function removeFromCart(cartItemId: number): Promise<void> {
    await apiClient.delete(`/cart/${cartItemId}`);
}
