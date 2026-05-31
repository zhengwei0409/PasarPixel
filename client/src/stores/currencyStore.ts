import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Currency } from "../types/asset";

// The currency the buyer wants to *see* prices in across the whole app.
// This is a client-side preference (not the seller's pricing currency, which
// lives per-asset in the DB). Every price display reads this single value so
// the UI is always consistent.
interface CurrencyState {
    displayCurrency: Currency;
    setDisplayCurrency: (currency: Currency) => void;
}

// `create` builds the store. The function receives `set`, which updates state.
// `persist` wraps it so the chosen value is saved to localStorage and restored
// on the next visit — no manual useEffect syncing needed.
export const useCurrencyStore = create<CurrencyState>()(
    persist(
        (set) => ({
            // Default to MYR — the target market is Malaysia.
            displayCurrency: "MYR",
            setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
        }),
        {
            name: "pasarpixel-currency", // localStorage key
        },
    ),
);
