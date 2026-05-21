export interface SocialLinks {
    github?: string;
    twitter?: string;
    linkedin?: string;
}

export interface UserProfile {
    name: string;
    bio: string | null;
    phone: string | null;
    socialLinks: SocialLinks | null;
}

export interface UpdateProfilePayload {
    name: string;
    bio: string;
    phone: string;
    socialLinks: SocialLinks;
}
