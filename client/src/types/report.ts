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

// Shape returned by the admin list endpoint (GET /reports): the raw report plus
// the looked-up reporter and reported asset.
export interface AdminReport {
    id: number;
    reason: string;
    status: ReportStatus;
    createdAt: string;
    updatedAt: string;
    asset: {
        id: number;
        title: string | null;
        status: string | null;
        sellerId: number | null;
    };
    reporter: {
        userId: number;
        name: string | null;
        email: string | null;
    };
}
