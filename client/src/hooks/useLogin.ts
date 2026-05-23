import { useMutation } from "@tanstack/react-query";
import { login } from "../services/authService";

export function useLogin() {
    return useMutation({
        mutationFn: login,
        onSuccess: (tokens) => {
            localStorage.setItem("accessToken", tokens.accessToken);
            localStorage.setItem("refreshToken", tokens.refreshToken);
            window.location.href = "/dashboard";
        },
    });
}
