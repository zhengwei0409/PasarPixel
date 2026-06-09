import type { Currency } from "./asset";

export interface UserProfile {
    name: string;
    bio: string | null;
    phone: string | null;
    country: string | null;
    billingAddress: string | null;
    avatarUrl: string | null;
    preferredCurrency: Currency;
}

export interface AvatarUploadUrlPayload {
    fileName: string;
    fileType: string;
    fileSize: number;
}

export interface AvatarUploadUrlResponse {
    uploadUrl: string;
    key: string;
    expiresIn: number;
}

export interface UpdateProfilePayload {
    name?: string;
    bio?: string;
    phone?: string;
    country?: string | null;
    billingAddress?: string | null;
    preferredCurrency?: Currency;
}
