import apiClient from "../lib/apiClient";
import type { AuthTokens } from "../types/auth";

export interface TwoFactorStatus {
    enabled: boolean;
}

export interface TwoFactorSetup {
    qrCode: string; // data:image/png;base64,... — render directly in an <img>
}

export interface TwoFactorEnableResult {
    message: string;
    recoveryCodes: string[]; // plaintext, shown to the user only once
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
    const res = await apiClient.get<TwoFactorStatus>("/auth/2fa/status");
    return res.data;
}

export async function setupTwoFactor(): Promise<TwoFactorSetup> {
    const res = await apiClient.post<TwoFactorSetup>("/auth/2fa/setup");
    return res.data;
}

export async function enableTwoFactor(code: string): Promise<TwoFactorEnableResult> {
    const res = await apiClient.post<TwoFactorEnableResult>("/auth/2fa/enable", { code });
    return res.data;
}

export async function disableTwoFactor(): Promise<void> {
    await apiClient.post("/auth/2fa/disable");
}

// Login step two: exchange the temp token + a code (authenticator or recovery)
// for the real login tokens.
export async function verifyLogin(tempToken: string, code: string): Promise<AuthTokens> {
    const res = await apiClient.post<AuthTokens>("/auth/2fa/verify-login", { tempToken, code });
    return res.data;
}
