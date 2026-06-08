import { useEffect, useState } from "react";
import { refreshAccessToken } from "../services/authService";

function parseRoles(token: string): string[] {
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return Array.isArray(payload.roles) ? payload.roles : [];
    } catch {
        return [];
    }
}

// On mount, silently re-issues the access token so roles granted after login
// (e.g. SELLER after admin approval) take effect. If new roles appeared, we
// stash the fresh token and flag it so the UI can prompt the user to reload.
// We do NOT auto-reload — that would yank the page out from under them.
export function useSyncRoles() {
    const [newRoles, setNewRoles] = useState<string[] | null>(null);

    useEffect(() => {
        const oldToken = localStorage.getItem("accessToken");
        const refreshToken = localStorage.getItem("refreshToken");
        if (!oldToken || !refreshToken) return;

        let cancelled = false;

        refreshAccessToken(refreshToken)
            .then((freshToken) => {
                if (cancelled) return;

                const before = parseRoles(oldToken);
                const after = parseRoles(freshToken);
                const gained = after.filter((r) => !before.includes(r));

                // Always persist the fresh token so a manual reload reflects
                // the latest roles even if nothing new was gained.
                localStorage.setItem("accessToken", freshToken);

                if (gained.length > 0) setNewRoles(gained);
            })
            .catch(() => {
                // Refresh token invalid/expired — leave auth as-is; existing
                // 401 handling will route the user to login when needed.
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return { newRoles };
}
