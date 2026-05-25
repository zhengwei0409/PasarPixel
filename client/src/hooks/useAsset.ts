import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createAsset,
    getAsset,
    getUploadUrl,
    uploadToS3,
    registerFile,
    deleteFile,
} from "../services/assetService";
import type { Asset, AssetFile, CreateAssetPayload } from "../types/asset";

export function useAsset(assetId: number | null) {
    return useQuery({
        queryKey: ["asset", assetId],
        queryFn: () => getAsset(assetId as number),
        enabled: assetId != null,
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

export type { Asset };
