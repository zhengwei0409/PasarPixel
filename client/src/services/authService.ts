import apiClient from "../lib/apiClient";
import type { AuthTokens, Credentials, LoginCredentials, LoginResult, ResetPasswordPayload } from "../types/auth";

export async function login(credentials: LoginCredentials): Promise<LoginResult> {
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

export async function getPasswordStatus(): Promise<{ hasPassword: boolean }> {
    const res = await apiClient.get<{ hasPassword: boolean }>("/auth/password/status");
    return res.data;
}

export async function changePassword(payload: { currentPassword: string; newPassword: string }): Promise<void> {
    await apiClient.post("/auth/change-password", payload);
}
