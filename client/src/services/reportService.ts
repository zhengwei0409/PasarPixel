import apiClient from "../lib/apiClient";
import type { AdminReport, CreateReportPayload, Report } from "../types/report";

export async function createReport(payload: CreateReportPayload): Promise<Report> {
    const res = await apiClient.post<Report>("/reports", payload);
    return res.data;
}

export async function getReports(): Promise<AdminReport[]> {
    const res = await apiClient.get<AdminReport[]>("/reports");
    return res.data;
}

export type ResolveReportAction = "take_down" | "dismiss";

export async function resolveReport(
    reportId: number,
    action: ResolveReportAction,
): Promise<Report> {
    const res = await apiClient.patch<Report>(`/reports/${reportId}/resolve`, { action });
    return res.data;
}
