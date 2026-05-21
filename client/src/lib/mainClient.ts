import axios from "axios";
import { getAccessToken } from "../hooks/useAuth";

const mainClient = axios.create({
    baseURL: "http://localhost:3002",
});

mainClient.interceptors.request.use(async (config) => {
    const token = await getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default mainClient;
