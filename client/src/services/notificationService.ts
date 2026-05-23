import apiClient from "../lib/apiClient";
import type { Notification } from "../types/notification";

export async function listNotifications(): Promise<Notification[]> {
    const res = await apiClient.get<Notification[]>("/notifications");
    return res.data;
}

export async function getUnreadCount(): Promise<number> {
    const res = await apiClient.get<{ count: number }>("/notifications/unread-count");
    return res.data.count;
}

export async function markNotificationAsRead(id: number): Promise<void> {
    await apiClient.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsAsRead(): Promise<void> {
    await apiClient.patch("/notifications/read-all");
}
