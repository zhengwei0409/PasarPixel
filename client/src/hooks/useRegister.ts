import { useMutation } from "@tanstack/react-query";
import { register } from "../services/authService";

export function useRegister() {
    return useMutation({
        mutationFn: register,
        onSuccess: (tokens) => {
            localStorage.setItem("accessToken", tokens.accessToken);
            localStorage.setItem("refreshToken", tokens.refreshToken);
            window.location.href = "/dashboard";
        },
    });
}
