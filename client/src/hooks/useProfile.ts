import { useQuery } from "@tanstack/react-query";
import { getProfile } from "../services/profileService";
import { useAuth } from './useAuth';

export function useProfile() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ["profile", "me"],
        queryFn: getProfile,
        enabled: Boolean(user),
    });
}
