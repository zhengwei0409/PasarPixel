import { useState } from "react";
import { useNavigate } from "react-router-dom";
import authApi from "../lib/authApi";

export function useRegister() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const register = async (email: string, password: string) => {
        setLoading(true);
        setError(null);

        try {
            const res = await authApi.post<{ token: string }>("/auth/register", { email, password });
            localStorage.setItem("token", res.data.token);
            navigate("/dashboard");
        } catch (err: any) {
            setError(err.response?.data?.error ?? "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return { register, loading, error };
}
