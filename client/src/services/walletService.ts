import apiClient from "@/lib/apiClient";
import type { WalletChallenge, WalletStatus } from "@/types/wallet";

export async function getWalletStatus(): Promise<WalletStatus> {
    return (await apiClient.get<WalletStatus>("/blockchain/wallet")).data;
}

export async function createWalletChallenge(address: string): Promise<WalletChallenge> {
    return (await apiClient.post<WalletChallenge>("/blockchain/wallet/challenge", { address })).data;
}

export async function verifyWalletChallenge(challengeId: string, signature: string, options?: { onlyIfUnbound: boolean }): Promise<WalletStatus> {
    return (await apiClient.post<WalletStatus>("/blockchain/wallet/verify", { challengeId, signature, ...options })).data;
}
