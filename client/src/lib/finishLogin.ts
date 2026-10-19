import type { AuthTokens } from "../types/auth";
import { getAuthUser, setAuthTokens } from './authSession';

// Persist tokens, then send sellers/admins to the dashboard and buyers home.
export function finishLogin(tokens: AuthTokens) {
    setAuthTokens(tokens);

    let destination = "/";
    if (getAuthUser()?.roles.some((role) => role === "SELLER" || role === "ADMIN")) {
        destination = "/dashboard";
    }

    window.location.href = destination;
}
