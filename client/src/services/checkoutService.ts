import apiClient from "../lib/apiClient";
import type { Currency } from "../types/asset";
import type { PaymentStatus } from "../types/order";

interface CheckoutResponse {
    url: string;
}

// Creates a Stripe Checkout session for the current cart and returns the
// hosted payment page URL to redirect the buyer to.
export async function createCheckout(currency: Currency): Promise<string> {
    const res = await apiClient.post<CheckoutResponse>("/checkout", { currency });
    return res.data.url;
}

// Asks the backend to confirm payment with Stripe and fulfil the order, so the
// success page doesn't have to wait for the async webhook. Idempotent server-side.
export async function verifyCheckout(orderId: number): Promise<PaymentStatus> {
    const res = await apiClient.get<{ paymentStatus: PaymentStatus }>(
        `/checkout/verify/${orderId}`,
    );
    return res.data.paymentStatus;
}
