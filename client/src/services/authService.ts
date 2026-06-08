import apiClient from "../lib/apiClient";
import type { AuthTokens, Credentials, LoginResult, ResetPasswordPayload } from "../types/auth";

export async function login(credentials: Credentials): Promise<LoginResult> {
    const res = await apiClient.post<LoginResult>("/auth/login", credentials);
    return res.data;
}

export async function register(credentials: Credentials): Promise<AuthTokens> {
    const res = await apiClient.post<AuthTokens>("/auth/register", credentials);
    return res.data;
}

export async function forgotPassword(email: string): Promise<void> {
    await apiClient.post("/auth/forgot-password", { email });
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
    await apiClient.post("/auth/reset-password", payload);
}

// Re-issues an access token. The auth-service re-reads roles from the DB when
// signing it, so this is how the client picks up roles granted after login
// (e.g. SELLER after admin approval) without a full logout/login.
export async function refreshAccessToken(refreshToken: string): Promise<string> {
    const res = await apiClient.post<{ accessToken: string }>("/auth/refresh", { refreshToken });
    return res.data.accessToken;
}
