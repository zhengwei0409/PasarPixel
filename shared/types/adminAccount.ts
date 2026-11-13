export type AccountStatus = "ACTIVE" | "TWO_FACTOR_LOCKED";

export interface AdminAccount {
    userId: number;
    email: string;
    createdAt: string;
    roles: string[];
    status: AccountStatus;
}
