import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    deleteAvatar,
    getAvatarUploadUrl,
    setAvatar,
    uploadAvatarToS3,
} from "../services/profileService";
import type { UserProfile } from "../types/profile";

export function useUploadAvatar() {
    const queryClient = useQueryClient();
    return useMutation<UserProfile, Error, File>({
        mutationFn: async (file: File) => {
            const { uploadUrl, key } = await getAvatarUploadUrl({
                fileName: file.name,
                fileType: file.type || "image/png",
                fileSize: file.size,
            });
            await uploadAvatarToS3(uploadUrl, file);
            return setAvatar(key);
        },
        onSuccess: (data) => {
            queryClient.setQueryData(["profile", "me"], data);
        },
    });
}

export function useDeleteAvatar() {
    const queryClient = useQueryClient();
    return useMutation<UserProfile, Error>({
        mutationFn: () => deleteAvatar(),
        onSuccess: (data) => {
            queryClient.setQueryData(["profile", "me"], data);
        },
    });
}
