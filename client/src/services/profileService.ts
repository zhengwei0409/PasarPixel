import axios from "axios";
import apiClient from "../lib/apiClient";
import { getSocialLinkUrls } from "../../../shared/utils/socialLinks";
import type {
    AvatarUploadUrlPayload,
    AvatarUploadUrlResponse,
    UpdateProfilePayload,
    UserProfile,
} from "../types/profile";

export class SocialLinksSaveError extends Error {
    constructor() {
        super("Your social links weren’t saved. Your edits are still here.");
    }
}

export async function getProfile(): Promise<UserProfile> {
    const res = await apiClient.get<UserProfile>("/profile/me");
    return res.data;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
    const res = await apiClient.patch<UserProfile>("/profile/me", payload);
    if (payload.socialLinks !== undefined) {
        const requestedLinks = getSocialLinkUrls(payload.socialLinks);
        const savedLinks = getSocialLinkUrls(res.data.socialLinks);
        if (requestedLinks.length !== savedLinks.length || requestedLinks.some((url, index) => url !== savedLinks[index])) {
            throw new SocialLinksSaveError();
        }
    }
    return res.data;
}

export async function getAvatarUploadUrl(
    payload: AvatarUploadUrlPayload,
): Promise<AvatarUploadUrlResponse> {
    const res = await apiClient.post<AvatarUploadUrlResponse>(
        "/profile/avatar/upload-url",
        payload,
    );
    return res.data;
}

export async function uploadAvatarToS3(uploadUrl: string, file: File): Promise<void> {
    await axios.put(uploadUrl, file, {
        headers: { "Content-Type": file.type },
    });
}

export async function setAvatar(key: string): Promise<UserProfile> {
    const res = await apiClient.patch<UserProfile>("/profile/avatar", { key });
    return res.data;
}

export async function deleteAvatar(): Promise<UserProfile> {
    const res = await apiClient.delete<UserProfile>("/profile/avatar");
    return res.data;
}
