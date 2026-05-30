import type { Currency } from "../types/asset";
import apiClient from "./apiClient";

// Fallback rate used before the real rate loads, or if the API is unreachable.
const FALLBACK_USD_TO_MYR = 4.7;

// Mutable live rate. convertFiat/formatPrice stay synchronous (they render in
// JSX), so they read this value rather than awaiting an API call. refreshExchangeRate()
// updates it once at app startup from the backend's real exchange-rate endpoint.
let usdToMyr = FALLBACK_USD_TO_MYR;

export async function refreshExchangeRate(): Promise<void> {
    try {
        const res = await apiClient.get<{ rate: number }>("/exchange-rate", {
            params: { from: "USD", to: "MYR" },
        });
        if (typeof res.data.rate === "number" && res.data.rate > 0) {
            usdToMyr = res.data.rate;
        }
    } catch {
        // Keep the fallback rate — price display is best-effort, not billing.
    }
}

const CURRENCY_SYMBOL: Record<Currency, string> = {
    USD: "$",
    MYR: "RM",
};

export function convertFiat(amount: number, from: Currency, to: Currency): number {
    if (from === to) return amount;
    if (from === "USD" && to === "MYR") return amount * usdToMyr;
    return amount / usdToMyr;
}

export function formatPrice(
    amount: number | string | null | undefined,
    from: Currency,
    displayIn: Currency = from,
): string {
    if (amount === null || amount === undefined || amount === "") return "—";
    const n = typeof amount === "number" ? amount : parseFloat(amount);
    if (isNaN(n)) return "—";
    if (n === 0) return "Free";
    const converted = convertFiat(n, from, displayIn);
    return `${CURRENCY_SYMBOL[displayIn]}${converted.toFixed(2)}`;
}

export function formatSol(amount: number | string | null | undefined): string {
    if (amount === null || amount === undefined || amount === "") return "—";
    const n = typeof amount === "number" ? amount : parseFloat(amount);
    if (isNaN(n)) return "—";
    if (n === 0) return "Free";
    return `${n.toFixed(2)} SOL`;
}
