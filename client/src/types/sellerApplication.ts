export type SellerApplicationStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";

export interface SellerApplication {
    id: number;
    userId: number;
    storeName: string;
    reason: string;
    portfolioLink: string | null;
    fullName: string | null;
    dateOfBirth: string | null;
    address: string | null;
    idDocumentKey: string | null;
    status: SellerApplicationStatus;
    adminNote: string | null;
    reviewedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface SellerApplicationWithUser extends SellerApplication {
    user: {
        name: string;
        avatarUrl: string | null;
    };
}

export interface SubmitApplicationPayload {
    storeName: string;
    reason: string;
    portfolioLink?: string;
    fullName: string;
    dateOfBirth: string;
    address: string;
    idDocumentKey: string;
}

export interface IdDocumentUploadUrlPayload {
    fileName: string;
    fileType: string;
    fileSize: number;
}

export interface IdDocumentUploadUrlResponse {
    uploadUrl: string;
    key: string;
    expiresIn: number;
}
