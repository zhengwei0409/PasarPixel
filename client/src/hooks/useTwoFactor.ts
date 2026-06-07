import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getTwoFactorStatus,
    setupTwoFactor,
    enableTwoFactor,
    disableTwoFactor,
    verifyLogin,
} from "../services/twoFactorService";
import { finishLogin } from "../lib/finishLogin";

const STATUS_KEY = ["twoFactor", "status"];

// Whether 2FA is currently enabled for the logged-in user.
export function useTwoFactorStatus() {
    return useQuery({
        queryKey: STATUS_KEY,
        queryFn: getTwoFactorStatus,
    });
}

// Step 1: generate a secret + QR code to scan.
export function useSetupTwoFactor() {
    return useMutation({
        mutationFn: setupTwoFactor,
    });
}

// Step 2: verify the scanned code and turn 2FA on. Refresh status afterwards.
export function useEnableTwoFactor() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: enableTwoFactor,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: STATUS_KEY });
        },
    });
}

// Login step two: submit the temp token + code, then complete the login.
export function useVerifyLogin(tempToken: string) {
    return useMutation({
        mutationFn: (code: string) => verifyLogin(tempToken, code),
        onSuccess: (tokens) => finishLogin(tokens),
    });
}

// Turn 2FA off. Refresh status afterwards.
export function useDisableTwoFactor() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: disableTwoFactor,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: STATUS_KEY });
        },
    });
}
