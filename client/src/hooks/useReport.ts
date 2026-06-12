import { useMutation, useQuery } from "@tanstack/react-query";
import { createReport, getReports } from "../services/reportService";
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
