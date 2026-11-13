import apiClient from "../lib/apiClient";
import type { AdminUser } from "../types/user";
import type { AdminUserDetail } from "../../../shared/types/adminUserDetail";
import type { AdminAccount } from "../../../shared/types/adminAccount";

export async function listUsers(): Promise<AdminUser[]> {
    const res = await apiClient.get<AdminUser[]>("/users");
    return res.data;
}

export async function getUserDetail(userId: number, activityPage: number, signal: AbortSignal): Promise<AdminUserDetail> {
    const res = await apiClient.get<AdminUserDetail>(`/users/${userId}`, { params: { activityPage }, signal });
    return res.data;
}

export async function deleteUser(userId: number, reason: string): Promise<void> {
    await apiClient.delete(`/users/${userId}`, { data: { reason } });
}

export async function updateAccountSuspension(userId: number, suspended: boolean, reason: string): Promise<AdminAccount> {
    const res = await apiClient.patch<AdminAccount>(`/auth/admin/accounts/${userId}/suspension`, { suspended, reason });
    return res.data;
}
