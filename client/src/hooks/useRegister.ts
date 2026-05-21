import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { register } from "../services/authService";

export function useRegister() {
    const navigate = useNavigate();

    return useMutation({
        mutationFn: register,
        onSuccess: (tokens) => {
            localStorage.setItem("accessToken", tokens.accessToken);
            localStorage.setItem("refreshToken", tokens.refreshToken);
            navigate("/dashboard");
        },
    });
}
