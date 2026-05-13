import { useState } from "react";
import { useNavigate } from "react-router-dom";
import authApi from "../lib/authApi";

export function useLogin() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const login = async (email: string, password: string) => {
        setLoading(true);
        setError(null);

        try {
            const res = await authApi.post<{ token: string }>("/auth/login", { email, password });
            localStorage.setItem("token", res.data.token);
            navigate("/dashboard");
        } catch (err: any) {
            setError(err.response?.data?.error ?? "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return { login, loading, error };
}
