export type MasterMintStatus = "PREPARING" | "AWAITING_SIGNATURE" | "PENDING" | "READY" | "FAILED";
export interface MasterMint {
    assetId: number; assetAddress: string; ownerAddress: string; status: MasterMintStatus;
    metadataUri: string | null; txSignature: string | null; error: string | null; explorerUrl: string;
    authorization: { id: string; message: string; expiresAt: string } | null;
}
export interface MasterMintResponse { enabled: boolean; master: MasterMint | null }
