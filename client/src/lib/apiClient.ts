import axios from "axios";
import { getAccessToken } from "../hooks/useAuth";

const PUBLIC_PATHS = [
    "/auth/login",
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

    const token = await getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default apiClient;
