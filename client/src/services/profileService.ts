import mainClient from "../lib/mainClient";
import type { UserProfile, UpdateProfilePayload } from "../types/profile";

export async function getProfile(): Promise<UserProfile> {
    const res = await mainClient.get<UserProfile>("/profile/me");
    return res.data;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
    const res = await mainClient.patch<UserProfile>("/profile/me", payload);
    return res.data;
}
