import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { clearAuthSession, getAccessToken, getSessionKey, refreshAuthSession } from "./authSession";

type AuthRequest = InternalAxiosRequestConfig & { _authRetry?: boolean; _authSession?: string | null };

const PUBLIC_PATHS = [
    "/auth/login",
    "/auth/2fa/verify-login",
    "/auth/register",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/refresh",
    "/auth/logout",
    "/orders/verify", // FR-3.5: public licence verification, no token needed
];

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

apiClient.interceptors.request.use(async (config) => {
    const url = config.url || "";
    const isPublic = PUBLIC_PATHS.some((p) => url.startsWith(p));
    if (isPublic) return config;

    const request = config as AuthRequest;
    const session = getSessionKey();
    if (request._authRetry && request._authSession !== session) {
        throw new axios.CanceledError('Sign-in session changed');
    }
    request._authSession = session;
    const token = await getAccessToken();
    if (getSessionKey() !== session) throw new axios.CanceledError('Sign-in session changed');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    } else {
        config.headers.delete('Authorization');
    }
    return config;
});

apiClient.interceptors.response.use((response) => response, async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config) throw error;
    const config = error.config as AuthRequest;
    if (PUBLIC_PATHS.some((path) => (config.url || '').startsWith(path))
        || !config.headers.Authorization || config._authSession !== getSessionKey()) throw error;

    if (config._authRetry) {
        // Do not let a late failure invalidate a newer token.
        if (config.headers.Authorization === `Bearer ${localStorage.getItem('accessToken')}`) clearAuthSession();
        throw error;
    }

    config._authRetry = true;
    const currentToken = localStorage.getItem('accessToken');
    const token = currentToken && config.headers.Authorization !== `Bearer ${currentToken}`
        ? currentToken : await refreshAuthSession();
    if (!token || config._authSession !== getSessionKey()) throw error;
    return apiClient(config);
});

export default apiClient;
