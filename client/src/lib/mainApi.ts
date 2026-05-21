import axios from "axios";
import { getAccessToken } from "../hooks/useAuth";

const mainApi = axios.create({
    baseURL: "http://localhost:3002",
});

mainApi.interceptors.request.use(async (config) => {
    const token = await getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default mainApi;
