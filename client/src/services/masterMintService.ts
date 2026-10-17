import apiClient from "@/lib/apiClient";
import type { MasterMintResponse } from "@/types/masterMint";

export async function getMasterMint(assetId: number): Promise<MasterMintResponse> {
    return (await apiClient.get<MasterMintResponse>(`/blockchain/masters/${assetId}`)).data;
}
export async function prepareMasterMint(assetId: number): Promise<MasterMintResponse> {
    return (await apiClient.post<MasterMintResponse>(`/blockchain/masters/${assetId}/prepare`)).data;
}
export async function authorizeMasterMint(assetId: number, authorizationId: string, signature: string): Promise<MasterMintResponse> {
    return (await apiClient.post<MasterMintResponse>(`/blockchain/masters/${assetId}/authorize`, { authorizationId, signature })).data;
}
