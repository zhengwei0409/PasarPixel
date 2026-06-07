import { useQuery } from "@tanstack/react-query";
import { getRoleLogs } from "../services/roleLogService";

export function useRoleLogs() {
    return useQuery({
        queryKey: ["role-logs"],
        queryFn: () => getRoleLogs(),
    });
}
