import { useMutation } from "@tanstack/react-query";
import { forgotPassword } from "../services/authService";

export function useForgotPassword() {
    return useMutation({
        mutationFn: forgotPassword,
    });
}
