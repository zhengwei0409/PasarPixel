export type SellerApplicationStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";

export interface SellerApplication {
    id: number;
    userId: number;
    storeName: string;
    reason: string;
    portfolioLink: string | null;
    idVerificationUrl: string | null;
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
    idVerificationUrl?: string;
}
