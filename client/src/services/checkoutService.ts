import apiClient from "../lib/apiClient";
import type { Currency } from "../types/asset";

interface CheckoutResponse {
    url: string;
}

// Creates a Stripe Checkout session for the current cart and returns the
// hosted payment page URL to redirect the buyer to.
export async function createCheckout(currency: Currency): Promise<string> {
    const res = await apiClient.post<CheckoutResponse>("/checkout", { currency });
    return res.data.url;
}
