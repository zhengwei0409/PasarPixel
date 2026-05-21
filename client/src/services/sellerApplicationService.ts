import mainClient from "../lib/mainClient";
import type { SellerApplication, SellerApplicationWithUser, SubmitApplicationPayload } from "../types/sellerApplication";

export async function submitApplication(payload: SubmitApplicationPayload): Promise<SellerApplication> {
    const res = await mainClient.post<SellerApplication>("/seller-applications", payload);
    return res.data;
}

export async function getMyApplication(): Promise<SellerApplication> {
    const res = await mainClient.get<SellerApplication>("/seller-applications/me");
    return res.data;
}

export async function listApplications(status?: string): Promise<SellerApplicationWithUser[]> {
    const res = await mainClient.get<SellerApplicationWithUser[]>("/seller-applications", {
        params: status ? { status } : undefined,
    });
    return res.data;
}

export async function approveApplication(id: number): Promise<void> {
    await mainClient.patch(`/seller-applications/${id}/approve`);
}

export async function rejectApplication(id: number, adminNote: string): Promise<void> {
    await mainClient.patch(`/seller-applications/${id}/reject`, { adminNote });
}
