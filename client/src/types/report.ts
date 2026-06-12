export type ReportStatus = "PENDING" | "TAKEN_DOWN" | "DISMISSED";

export interface Report {
    id: number;
    userId: number;
    assetId: number;
    reason: string;
    status: ReportStatus;
    createdAt: string;
    updatedAt: string;
}

export interface CreateReportPayload {
    assetId: number;
    reason: string;
}
