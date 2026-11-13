export type AccountStatus = "ACTIVE" | "TWO_FACTOR_LOCKED" | "SUSPENDED";

export const ACCOUNT_MODERATION_REASON_LIMIT = 500;
export const ACCOUNT_SUSPENDED_CODE = "ACCOUNT_SUSPENDED";
export const ACCOUNT_SUSPENDED_MESSAGE = "Your PasarPixel account is suspended.";

export interface AdminAccount {
    userId: number;
    email: string;
    createdAt: string;
    roles: string[];
    status: AccountStatus;
}
