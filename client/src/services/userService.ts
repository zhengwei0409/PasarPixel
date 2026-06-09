import apiClient from "../lib/apiClient";
import type { AdminUser } from "../types/user";

export async function listUsers(): Promise<AdminUser[]> {
    const res = await apiClient.get<AdminUser[]>("/users");
    return res.data;
}

export async function deleteUser(userId: number): Promise<void> {
    await apiClient.delete(`/users/${userId}`);
}
