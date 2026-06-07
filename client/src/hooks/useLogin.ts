import { useMutation } from "@tanstack/react-query";
import { login } from "../services/authService";
import { finishLogin } from "../lib/finishLogin";

// onTwoFactorRequired fires when the account has 2FA on; the page then shows
// the code-entry step using the provided temp token.
export function useLogin(onTwoFactorRequired: (tempToken: string) => void) {
    return useMutation({
        mutationFn: login,
        onSuccess: (result) => {
            if ("twoFactorRequired" in result) {
                onTwoFactorRequired(result.tempToken);
                return;
            }
            finishLogin(result);
        },
    });
}
