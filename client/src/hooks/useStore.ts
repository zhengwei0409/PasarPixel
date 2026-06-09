import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getStore,
    getStoreAssets,
    getMyStore,
    updateMyStore,
    getStoreImageUploadUrl,
    uploadStoreImageToS3,
    setStoreImage,
} from "../services/storeService";
import type { StoreImageKind, UpdateStorePayload } from "../types/store";

export function useStore(sellerId: number | null) {
    return useQuery({
        queryKey: ["store", sellerId],
        queryFn: () => getStore(sellerId as number),
        enabled: sellerId !== null,
    });
}

export function useStoreAssets(sellerId: number | null) {
    return useQuery({
        queryKey: ["store", sellerId, "assets"],
        queryFn: () => getStoreAssets(sellerId as number),
        enabled: sellerId !== null,
    });
}

export function useMyStore() {
    return useQuery({
        queryKey: ["store", "me"],
        queryFn: getMyStore,
    });
}

export function useUpdateMyStore() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: UpdateStorePayload) => updateMyStore(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["store"] });
        },
    });
}

// Uploads a logo/banner: get presigned URL → PUT to S3 → tell the API to apply
// the key. Mirrors the avatar upload flow on the profile page.
export function useUploadStoreImage() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ kind, file }: { kind: StoreImageKind; file: File }) => {
            const { uploadUrl, key } = await getStoreImageUploadUrl(kind, {
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
            });
            await uploadStoreImageToS3(uploadUrl, file);
            return setStoreImage(kind, key);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["store"] });
        },
    });
}
