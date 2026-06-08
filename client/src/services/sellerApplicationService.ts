import axios from "axios";
import apiClient from "../lib/apiClient";
import type {
    SellerApplication,
    SellerApplicationWithUser,
    SubmitApplicationPayload,
    IdDocumentUploadUrlPayload,
    IdDocumentUploadUrlResponse,
} from "../types/sellerApplication";

export async function submitApplication(payload: SubmitApplicationPayload): Promise<SellerApplication> {
    const res = await apiClient.post<SellerApplication>("/seller-applications", payload);
    return res.data;
}

export async function getIdDocumentUploadUrl(
    payload: IdDocumentUploadUrlPayload,
): Promise<IdDocumentUploadUrlResponse> {
    const res = await apiClient.post<IdDocumentUploadUrlResponse>(
        "/seller-applications/id-document/upload-url",
        payload,
    );
    return res.data;
}

export async function uploadIdDocumentToS3(uploadUrl: string, file: File): Promise<void> {
    await axios.put(uploadUrl, file, {
        headers: { "Content-Type": file.type },
    });
}

export async function getMyApplication(): Promise<SellerApplication> {
    const res = await apiClient.get<SellerApplication>("/seller-applications/me");
    return res.data;
}

export async function listApplications(status?: string): Promise<SellerApplicationWithUser[]> {
    const res = await apiClient.get<SellerApplicationWithUser[]>("/seller-applications", {
        params: status ? { status } : undefined,
    });
    return res.data;
}

export async function approveApplication(id: number): Promise<void> {
    await apiClient.patch(`/seller-applications/${id}/approve`);
}

export async function rejectApplication(id: number, adminNote: string): Promise<void> {
    await apiClient.patch(`/seller-applications/${id}/reject`, { adminNote });
}

export async function revokeSeller(userId: number): Promise<void> {
    await apiClient.post(`/seller-applications/sellers/${userId}/revoke`);
}

export async function reinstateSeller(userId: number): Promise<void> {
    await apiClient.post(`/seller-applications/sellers/${userId}/reinstate`);
}
