import { useCurrencyStore } from "../stores/currencyStore";
import { useUpdateProfile } from "./useUpdateProfile";
import { useAuth } from "./useAuth";
import type { Currency } from "../types/asset";

/**
 * Returns a setter that updates the global currency store and, for logged-in
 * users, also persists the choice to their profile (cross-device sync).
 *
 * The store update is instant (optimistic); the DB write is fire-and-forget so
 * a network hiccup never blocks the UI. Guests just update localStorage.
 */
export function useSetCurrency() {
    const setDisplayCurrency = useCurrencyStore((s) => s.setDisplayCurrency);
    const { user } = useAuth();
    const updateProfile = useUpdateProfile();

    return (currency: Currency) => {
        setDisplayCurrency(currency);
        if (user) {
            updateProfile.mutate({ preferredCurrency: currency });
        }
    };
}
