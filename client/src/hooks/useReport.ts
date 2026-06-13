import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createReport,
    getReports,
    resolveReport,
    type ResolveReportAction,
} from "../services/reportService";
import type { CreateReportPayload, Report } from "../types/report";

export function useCreateReport() {
    return useMutation<Report, Error, CreateReportPayload>({
        mutationFn: (payload) => createReport(payload),
    });
}

export function useReports() {
    return useQuery({
        queryKey: ["reports"],
        queryFn: () => getReports(),
    });
}

interface ResolveReportVars {
    reportId: number;
    action: ResolveReportAction;
    reason?: string;
}

export function useResolveReport() {
    const queryClient = useQueryClient();
    return useMutation<Report, Error, ResolveReportVars>({
        mutationFn: ({ reportId, action, reason }) =>
            resolveReport(reportId, action, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["reports"] });
        },
    });
}
