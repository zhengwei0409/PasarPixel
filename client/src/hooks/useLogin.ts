import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authService";

export function useLogin() {
    const navigate = useNavigate();

    return useMutation({
        mutationFn: login,
        onSuccess: (tokens) => {
            localStorage.setItem("accessToken", tokens.accessToken);
            localStorage.setItem("refreshToken", tokens.refreshToken);
            navigate("/dashboard");
        },
    });
}
