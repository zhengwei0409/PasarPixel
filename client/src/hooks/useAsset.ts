import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    approveAsset,
    browseAssets,
    createAsset,
    getAsset,
    getPublicAsset,
    getRelatedAssets,
    getMyAssets,
    getPendingReviewAssets,
    getAssetForReview,
    getUploadUrl,
    uploadToS3,
    registerFile,
    rejectAsset,
    deleteAsset,
    deleteFile,
    cancelSubmission,
    submitForReview,
    updateAsset,
    getAssetReviews,
    submitReview,
    deleteReview,
} from "../services/assetService";
import type {
    Asset,
    AssetFile,
    AssetFilePurpose,
    BrowseAssetsParams,
    CreateAssetPayload,
    UpdateAssetPayload,
    Review,
    SubmitReviewPayload,
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

export function useRelatedAssets(assetId: number | null) {
    return useQuery({
        queryKey: ["assets", "related", assetId],
        queryFn: () => getRelatedAssets(assetId as number),
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

export function useAssetForReview(assetId: number | null) {
    return useQuery({
        queryKey: ["assets", "review", assetId],
        queryFn: () => getAssetForReview(assetId as number),
        enabled: assetId != null,
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
    purpose?: AssetFilePurpose;
    onProgress?: (percent: number) => void;
}

export function useUploadAssetFile() {
    const queryClient = useQueryClient();
    return useMutation<AssetFile, Error, UploadAssetFileVars>({
        mutationFn: async ({ assetId, file, purpose, onProgress }) => {
            const { uploadUrl, key } = await getUploadUrl(assetId, {
                fileName: file.name,
                fileType: file.type || "application/octet-stream",
                fileSize: file.size,
                purpose,
            });
            await uploadToS3(uploadUrl, file, onProgress);
            return registerFile(assetId, {
                key,
                fileType: file.type || "application/octet-stream",
                fileSize: file.size,
                purpose,
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

export function useAssetReviews(assetId: number | null) {
    return useQuery({
        queryKey: ["assets", "reviews", assetId],
        queryFn: () => getAssetReviews(assetId as number),
        enabled: assetId != null,
    });
}

export interface SubmitReviewVars {
    assetId: number;
    payload: SubmitReviewPayload;
}

export function useSubmitReview() {
    const queryClient = useQueryClient();
    return useMutation<Review, Error, SubmitReviewVars>({
        mutationFn: ({ assetId, payload }) => submitReview(assetId, payload),
        onSuccess: (_data, vars) => {
            queryClient.invalidateQueries({ queryKey: ["assets", "reviews", vars.assetId] });
            // The asset's averageRating/reviewCount changed too.
            queryClient.invalidateQueries({ queryKey: ["assets", "public", vars.assetId] });
        },
    });
}

export function useDeleteReview() {
    const queryClient = useQueryClient();
    return useMutation<void, Error, number>({
        mutationFn: (assetId: number) => deleteReview(assetId),
        onSuccess: (_data, assetId) => {
            queryClient.invalidateQueries({ queryKey: ["assets", "reviews", assetId] });
            queryClient.invalidateQueries({ queryKey: ["assets", "public", assetId] });
        },
    });
}

export type { Asset };
