import apiClient from "../lib/apiClient";
import type { UserProfile, UpdateProfilePayload } from "../types/profile";

export async function getProfile(): Promise<UserProfile> {
    const res = await apiClient.get<UserProfile>("/profile/me");
    return res.data;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
    const res = await apiClient.patch<UserProfile>("/profile/me", payload);
    return res.data;
}
