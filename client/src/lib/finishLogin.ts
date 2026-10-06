import type { AuthTokens } from "../types/auth";

// Persist tokens, then send sellers/admins to the dashboard and buyers home.
export function finishLogin(tokens: AuthTokens) {
    localStorage.setItem("accessToken", tokens.accessToken);
    localStorage.setItem("refreshToken", tokens.refreshToken);

    let destination = "/";
    try {
        const { roles } = JSON.parse(atob(tokens.accessToken.split(".")[1]));
        if (Array.isArray(roles) && roles.some((role) => role === "SELLER" || role === "ADMIN")) {
            destination = "/dashboard";
        }
    } catch {
        // Fall back to the public homepage if the token cannot be decoded.
    }

    window.location.href = destination;
}
