import { useMutation } from "@tanstack/react-query";
import { resetPassword } from "../services/authService";

export function useResetPassword() {
    return useMutation({
        mutationFn: resetPassword,
    });
}
