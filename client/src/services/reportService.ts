import apiClient from "../lib/apiClient";
import type { CreateReportPayload, Report } from "../types/report";

export async function createReport(payload: CreateReportPayload): Promise<Report> {
    const res = await apiClient.post<Report>("/reports", payload);
    return res.data;
}
