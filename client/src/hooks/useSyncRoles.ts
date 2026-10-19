import { useEffect, useState } from "react";
import { getAuthUser, refreshAuthSession } from '../lib/authSession';

// Refresh shared auth state on mount so newly granted roles take effect immediately.
export function useSyncRoles() {
    const [newRoles, setNewRoles] = useState<string[] | null>(null);

    useEffect(() => {
        const oldUser = getAuthUser();
        if (!oldUser) return;

        let cancelled = false;

        refreshAuthSession()
            .then((freshToken) => {
                if (cancelled || !freshToken) return;

                const after = getAuthUser()?.roles ?? [];
                const gained = after.filter((r) => !oldUser.roles.includes(r));

                if (gained.length > 0) setNewRoles(gained);
            })
            .catch(() => {
                // Temporary outages preserve the session and can be retried later.
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return { newRoles };
}
