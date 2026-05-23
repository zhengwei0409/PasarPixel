import apiClient from "../lib/apiClient";
import type { AuthTokens, Credentials, ResetPasswordPayload } from "../types/auth";

export async function login(credentials: Credentials): Promise<AuthTokens> {
    const res = await apiClient.post<AuthTokens>("/auth/login", credentials);
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
