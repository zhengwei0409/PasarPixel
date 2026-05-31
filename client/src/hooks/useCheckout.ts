import { useMutation } from "@tanstack/react-query";
import { createCheckout } from "../services/checkoutService";
import type { Currency } from "../types/asset";

// Returns the Stripe Checkout URL; the caller redirects the browser to it.
export function useCheckout() {
    return useMutation<string, Error, Currency>({
        mutationFn: (currency) => createCheckout(currency),
    });
}
