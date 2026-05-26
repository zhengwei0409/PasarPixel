import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    approveAsset,
    createAsset,
    getAsset,
    getMyAssets,
    getPendingReviewAssets,
    getUploadUrl,
    uploadToS3,
    registerFile,
    rejectAsset,
    deleteFile,
    submitForReview,
    takeDownAsset,
} from "../services/assetService";
import type { Asset, AssetFile, CreateAssetPayload } from "../types/asset";

export function useAsset(assetId: number | null) {
    return useQuery({
        queryKey: ["asset", assetId],
        queryFn: () => getAsset(assetId as number),
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

export function useTakeDownAsset() {
    const queryClient = useQueryClient();
    return useMutation<Asset, Error, number>({
        mutationFn: (assetId: number) => takeDownAsset(assetId),
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
    return useMutation({
        mutationFn: (payload: CreateAssetPayload) => createAsset(payload),
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
