import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    listNotifications,
    getUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
} from "../services/notificationService";

export function useNotifications(enabled: boolean = true) {
    return useQuery({
        queryKey: ["notifications", "list"],
        queryFn: listNotifications,
        enabled,
    });
}

export function useUnreadCount() {
    return useQuery({
        queryKey: ["notifications", "unread-count"],
        queryFn: getUnreadCount,
        refetchInterval: 30_000,
    });
}

export function useMarkAsRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: markNotificationAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });
}

export function useMarkAllAsRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: markAllNotificationsAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });
}
