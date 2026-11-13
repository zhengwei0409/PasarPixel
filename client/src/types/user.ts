import type { AdminAccount } from "../../../shared/types/adminAccount";

export interface AdminUser extends AdminAccount {
    name: string;
    avatarUrl: string | null;
    hasProfile: boolean;
}
