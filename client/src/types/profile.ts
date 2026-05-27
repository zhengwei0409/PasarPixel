export interface SocialLinks {
    github?: string;
    twitter?: string;
    linkedin?: string;
}

export interface UserProfile {
    name: string;
    bio: string | null;
    phone: string | null;
    avatarUrl: string | null;
    socialLinks: SocialLinks | null;
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
    name: string;
    bio: string;
    phone: string;
    socialLinks: SocialLinks;
}
