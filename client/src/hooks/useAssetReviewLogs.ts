import { useQuery } from "@tanstack/react-query";
import { getAssetReviewLogs } from "../services/assetReviewLogService";

export function useAssetReviewLogs() {
    return useQuery({
        queryKey: ["asset-review-logs"],
        queryFn: () => getAssetReviewLogs(),
    });
}
