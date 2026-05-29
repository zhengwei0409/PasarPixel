import type { LicenseType } from "../types/cart";

const STORAGE_KEY = "pendingCartItem";

export interface PendingCartItem {
    assetId: number;
    licenseType: LicenseType;
}

export function savePendingCartItem(item: PendingCartItem): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(item));
}

export function getPendingCartItem(): PendingCartItem | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (
            typeof parsed?.assetId === "number" &&
            (parsed?.licenseType === "PERSONAL" || parsed?.licenseType === "COMMERCIAL")
        ) {
            return parsed as PendingCartItem;
        }
        return null;
    } catch {
        return null;
    }
}

export function clearPendingCartItem(): void {
    localStorage.removeItem(STORAGE_KEY);
}
