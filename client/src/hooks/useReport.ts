import { useMutation } from "@tanstack/react-query";
import { createReport } from "../services/reportService";
import type { CreateReportPayload, Report } from "../types/report";

export function useCreateReport() {
    return useMutation<Report, Error, CreateReportPayload>({
        mutationFn: (payload) => createReport(payload),
    });
}
