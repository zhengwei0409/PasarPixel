import { useQuery } from "@tanstack/react-query";
import { getProfile } from "../services/profileService";

export function useProfile() {
    return useQuery({
        queryKey: ["profile", "me"],
        queryFn: getProfile,
    });
}
