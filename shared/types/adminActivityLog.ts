export const ACTIVITY_CATEGORIES = {
    ROLE_CHANGE: "Role changes",
    ASSET_REVIEW: "Asset reviews",
    OTHER: "Other activity",
} as const;

export type ActivityCategory = keyof typeof ACTIVITY_CATEGORIES;

export interface AdminActivityFilters {
    search?: string;
    category?: ActivityCategory;
    from?: string;
    to?: string;
}

export interface AdminActivityEntry {
    id: string;
    category: ActivityCategory;
    action: string;
    actorId: number;
    actorName: string | null;
    actorEmail: string | null;
    targetId: number | null;
    targetLabel: string | null;
    reason: string | null;
    createdAt: string;
}

export interface AdminActivityPage {
    items: AdminActivityEntry[];
    hasNextPage: boolean;
}
