import { useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { bindPhantomWallet, disconnectPhantom, getConnectedAddress, getPhantom, subscribeToPhantom } from "@/lib/phantom";
import { createWalletChallenge, getWalletStatus, verifyWalletChallenge } from "@/services/walletService";

export function useWallet() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const connectedAddress = useSyncExternalStore(subscribeToPhantom, getConnectedAddress, () => null);
    const queryKey = ["wallet", user?.sub];
    const status = useQuery({ queryKey, queryFn: getWalletStatus, enabled: Boolean(user), refetchOnWindowFocus: true });
    const bind = useMutation({
        mutationFn: async () => {
            const provider = getPhantom();
            if (!provider) throw new Error("Install Phantom, then reload this page to connect your wallet.");
            const assertSession = () => {
                const token = localStorage.getItem("accessToken");
                let subject: unknown;
                try { subject = token ? JSON.parse(atob(token.split(".")[1])).sub : null; } catch { subject = null; }
                if (!user || String(subject) !== String(user.sub)) {
                    throw new Error("Your signed-in account changed. Reload this page and try again.");
                }
            };
            return bindPhantomWallet(provider, {
                challenge: createWalletChallenge, verify: verifyWalletChallenge,
            }, assertSession, window.location.origin);
        },
        onSuccess: (data) => { queryClient.setQueryData(queryKey, data); },
    });
    const disconnect = useMutation({
        mutationFn: disconnectPhantom,
    });
    return { status, bind, disconnect, connectedAddress };
}
