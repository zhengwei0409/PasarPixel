import type { AccountStatus } from "../../../../shared/types/adminAccount";
import { ACCOUNT_STATUS_LABELS } from "../../lib/accountStatus";

const statusColors: Record<AccountStatus, string> = {
    ACTIVE: "bg-accent text-accent-foreground",
    TWO_FACTOR_LOCKED: "bg-amber-100 text-amber-900",
    SUSPENDED: "bg-red-100 text-red-900",
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
    return (
        <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${statusColors[status]}`}>
            {ACCOUNT_STATUS_LABELS[status]}
        </span>
    );
}
