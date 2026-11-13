import type { AdminAccount } from "./adminAccount";

export interface AdminAccountDetail extends AdminAccount {
    twoFactorEnabled: boolean;
}

export interface AdminUserProfile {
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    phone: string | null;
    country: string | null;
    billingAddress: string | null;
    preferredCurrency: "MYR" | "USD";
    socialLinks: string[];
    updatedAt: string;
}

export interface AdminUserActivityCounts {
    orders: number;
    listings: number;
    reviews: number;
    reports: number;
}

export interface AdminUserActivity {
    id: string;
    kind: "order" | "listing" | "review" | "report" | "application" | "role" | "admin";
    title: string;
    detail?: string;
    occurredAt: string;
}

export interface AdminUserDetail {
    account: AdminAccountDetail;
    profile: AdminUserProfile | null;
    wallet: { status: "linked"; address: string } | { status: "unlinked" | "unavailable" };
    activity: {
        counts: AdminUserActivityCounts;
        recent: AdminUserActivity[];
        page: number;
        totalPages: number;
    };
}
