import type { AccountStatus } from "../../../shared/types/adminAccount";

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
    ACTIVE: "Active",
    TWO_FACTOR_LOCKED: "2FA locked",
    SUSPENDED: "Suspended",
};
