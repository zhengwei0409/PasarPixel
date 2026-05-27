import type { Currency } from "../types/asset";

export const USD_TO_MYR = 4.7;

const CURRENCY_SYMBOL: Record<Currency, string> = {
    USD: "$",
    MYR: "RM",
};

export function convertFiat(amount: number, from: Currency, to: Currency): number {
    if (from === to) return amount;
    if (from === "USD" && to === "MYR") return amount * USD_TO_MYR;
    return amount / USD_TO_MYR;
}

export function formatPrice(
    amount: number | string | null | undefined,
    from: Currency,
    displayIn: Currency = from,
): string {
    if (amount === null || amount === undefined || amount === "") return "—";
    const n = typeof amount === "number" ? amount : parseFloat(amount);
    if (isNaN(n)) return "—";
    const converted = convertFiat(n, from, displayIn);
    return `${CURRENCY_SYMBOL[displayIn]}${converted.toFixed(2)}`;
}

export function formatSol(amount: number | string | null | undefined): string {
    if (amount === null || amount === undefined || amount === "") return "—";
    const n = typeof amount === "number" ? amount : parseFloat(amount);
    if (isNaN(n)) return "—";
    return `${n.toFixed(2)} SOL`;
}
