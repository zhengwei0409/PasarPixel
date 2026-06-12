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
