import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProfile } from "../services/profileService";

export function useUpdateProfile() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: updateProfile,
        onSuccess: (data) => {
            queryClient.setQueryData(["profile", "me"], data);
        },
    });
}
