export interface WalletStatus {
    network: "solana:devnet";
    wallet: { address: string; verifiedAt: string; createdAt: string; updatedAt: string } | null;
    canChange: boolean;
    lockedReason: "NFT_OWNERSHIP" | "PENDING_TRANSACTION" | null;
}

export interface WalletChallenge {
    challengeId: string;
    address: string;
    message: string;
    expiresAt: string;
    network: "solana:devnet";
}
