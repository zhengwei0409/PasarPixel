import { useMutation } from "@tanstack/react-query";
import { createCheckout, type CheckoutPayload } from "../services/checkoutService";

// Returns the Stripe Checkout URL; the caller redirects the browser to it.
export function useCheckout() {
    return useMutation<string, Error, CheckoutPayload>({
        mutationFn: (payload) => createCheckout(payload),
    });
}
