import { validInternalToken } from "../../../../shared/utils/internalAuth";
export { validInternalToken };

export async function internalJson(base: string, path: string, init: RequestInit = {}) {
    const token = process.env.INTERNAL_SERVICE_TOKEN;
    if (!token || token.length < 32) throw new Error("Blockchain service authentication is not configured");
    const response = await fetch(`${base.replace(/\/$/, "")}${path}`, { ...init,
        headers: { ...init.headers, "x-internal-token": token }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error("Blockchain verification unavailable");
    return response.json();
}

export function purchaseProof(reference: string) {
    if (!/^[a-f0-9-]{36}$/.test(reference)) throw new Error("Invalid purchase reference");
    return internalJson(process.env.BLOCKCHAIN_SERVICE_URL || "http://blockchain-service:3004",
        `/blockchain/internal/purchases/${reference}`);
}

export async function activeAccount(userId: number, role: string) {
    const account = await internalJson(process.env.AUTH_SERVICE_URL || "http://auth-service:3001",
        `/auth/internal/accounts/${userId}`);
    return account.exists && account.roles.includes(role);
}
