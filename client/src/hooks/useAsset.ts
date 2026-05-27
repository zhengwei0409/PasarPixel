import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    approveAsset,
    browseAssets,
    createAsset,
    getAsset,
    getPublicAsset,
    getMyAssets,
    getPendingReviewAssets,
    getUploadUrl,
    uploadToS3,
    registerFile,
    rejectAsset,
    deleteAsset,
    deleteFile,
    cancelSubmission,
    submitForReview,
    updateAsset,
} from "../services/assetService";
import type {
    Asset,
    AssetFile,
    BrowseAssetsParams,
    CreateAssetPayload,
    UpdateAssetPayload,
} from "../types/asset";

export function useAsset(assetId: number | null) {
    return useQuery({
        queryKey: ["asset", assetId],
        queryFn: () => getAsset(assetId as number),
        enabled: assetId != null,
    });
}

export function useBrowseAssets(params: BrowseAssetsParams) {
    return useQuery({
        queryKey: ["assets", "browse", params],
        queryFn: () => browseAssets(params),
    });
}

export function usePublicAsset(assetId: number | null) {
    return useQuery({
        queryKey: ["assets", "public", assetId],
        queryFn: () => getPublicAsset(assetId as number),
        enabled: assetId != null,
    });
}

export function useMyAssets() {
    return useQuery({
        queryKey: ["assets", "mine"],
        queryFn: () => getMyAssets(),
    });
}

export function usePendingReviewAssets() {
    return useQuery({
        queryKey: ["assets", "pending-review"],
        queryFn: () => getPendingReviewAssets(),
    });
}

export function useApproveAsset() {
    const queryClient = useQueryClient();
    return useMutation<Asset, Error, number>({
        mutationFn: (assetId: number) => approveAsset(assetId),
        onSuccess: (_data, assetId) => {
            queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
            queryClient.invalidateQueries({ queryKey: ["assets", "pending-review"] });
            queryClient.invalidateQueries({ queryKey: ["assets", "mine"] });
        },
    });
}

export function useDeleteAsset() {
    const queryClient = useQueryClient();
    return useMutation<Asset | null, Error, number>({
        mutationFn: (assetId: number) => deleteAsset(assetId),
        onSuccess: (_data, assetId) => {
            queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
            queryClient.invalidateQueries({ queryKey: ["assets", "mine"] });
        },
    });
}

export function useCancelSubmission() {
    const queryClient = useQueryClient();
    return useMutation<Asset, Error, number>({
        mutationFn: (assetId: number) => cancelSubmission(assetId),
        onSuccess: (_data, assetId) => {
            queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
            queryClient.invalidateQueries({ queryKey: ["assets", "mine"] });
        },
    });
}

export interface RejectAssetVars {
    assetId: number;
    reason: string;
}

export function useRejectAsset() {
    const queryClient = useQueryClient();
    return useMutation<Asset, Error, RejectAssetVars>({
        mutationFn: ({ assetId, reason }) => rejectAsset(assetId, reason),
        onSuccess: (_data, vars) => {
            queryClient.invalidateQueries({ queryKey: ["asset", vars.assetId] });
            queryClient.invalidateQueries({ queryKey: ["assets", "pending-review"] });
            queryClient.invalidateQueries({ queryKey: ["assets", "mine"] });
        },
    });
}

export function useCreateAsset() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateAssetPayload) => createAsset(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["assets", "mine"] });
        },
    });
}

export interface UpdateAssetVars {
    assetId: number;
    payload: UpdateAssetPayload;
}

export function useUpdateAsset() {
    const queryClient = useQueryClient();
    return useMutation<Asset, Error, UpdateAssetVars>({
        mutationFn: ({ assetId, payload }) => updateAsset(assetId, payload),
        onSuccess: (_data, vars) => {
            queryClient.invalidateQueries({ queryKey: ["asset", vars.assetId] });
            queryClient.invalidateQueries({ queryKey: ["assets", "mine"] });
        },
    });
}

export interface UploadAssetFileVars {
    assetId: number;
    file: File;
    onProgress?: (percent: number) => void;
}

export function useUploadAssetFile() {
    const queryClient = useQueryClient();
    return useMutation<AssetFile, Error, UploadAssetFileVars>({
        mutationFn: async ({ assetId, file, onProgress }) => {
            const { uploadUrl, key } = await getUploadUrl(assetId, {
                fileName: file.name,
                fileType: file.type || "application/octet-stream",
                fileSize: file.size,
            });
            await uploadToS3(uploadUrl, file, onProgress);
            return registerFile(assetId, {
                key,
                fileType: file.type || "application/octet-stream",
                fileSize: file.size,
            });
        },
        onSuccess: (_data, vars) => {
            queryClient.invalidateQueries({ queryKey: ["asset", vars.assetId] });
        },
    });
}

export interface DeleteAssetFileVars {
    assetId: number;
    fileId: number;
}

export function useDeleteAssetFile() {
    const queryClient = useQueryClient();
    return useMutation<void, Error, DeleteAssetFileVars>({
        mutationFn: ({ assetId, fileId }) => deleteFile(assetId, fileId),
        onSuccess: (_data, vars) => {
            queryClient.invalidateQueries({ queryKey: ["asset", vars.assetId] });
        },
    });
}

export function useSubmitForReview() {
    const queryClient = useQueryClient();
    return useMutation<Asset, Error, number>({
        mutationFn: (assetId: number) => submitForReview(assetId),
        onSuccess: (_data, assetId) => {
            queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
            queryClient.invalidateQueries({ queryKey: ["assets", "mine"] });
        },
    });
}

export type { Asset };
