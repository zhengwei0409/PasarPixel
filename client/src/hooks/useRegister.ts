import { useMutation } from "@tanstack/react-query";
import { register } from "../services/authService";
import { setAuthTokens } from '../lib/authSession';

export function useRegister() {
    return useMutation({
        mutationFn: register,
        onSuccess: (tokens) => {
            setAuthTokens(tokens);
            window.location.href = "/dashboard";
        },
    });
}
