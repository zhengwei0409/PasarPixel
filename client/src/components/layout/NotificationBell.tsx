import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    useNotifications,
    useUnreadCount,
    useMarkAsRead,
    useMarkAllAsRead,
} from "@/hooks/useNotifications";
import type { Notification } from "@/types/notification";

function formatTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
}

export default function NotificationBell() {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const { data: unreadCount = 0 } = useUnreadCount();
    const { data: notifications = [], isLoading } = useNotifications(open);
    const markAsRead = useMarkAsRead();
    const markAllAsRead = useMarkAllAsRead();

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    const handleClickNotification = (n: Notification) => {
        if (!n.readAt) markAsRead.mutate(n.id);
    };

    const badge = unreadCount > 9 ? "9+" : String(unreadCount);

    return (
        <div ref={containerRef} className="relative">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen((v) => !v)}
                className="relative"
                aria-label="Notifications"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                        {badge}
                    </span>
                )}
            </Button>

            {open && (
                <div className="absolute right-0 mt-2 w-[360px] rounded-md border bg-white shadow-lg z-50">
                    <div className="flex items-center justify-between border-b px-4 py-2">
                        <h3 className="text-sm font-semibold">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={() => markAllAsRead.mutate()}
                                className="text-xs text-blue-600 hover:underline"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {isLoading ? (
                            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                                Loading...
                            </p>
                        ) : notifications.length === 0 ? (
                            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                                No notifications yet
                            </p>
                        ) : (
                            notifications.map((n) => (
                                <button
                                    key={n.id}
                                    onClick={() => handleClickNotification(n)}
                                    className={`w-full border-b px-4 py-3 text-left hover:bg-gray-50 ${
                                        n.readAt ? "bg-white" : "bg-blue-50"
                                    }`}
                                >
                                    <p className="text-sm font-semibold">{n.title}</p>
                                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                        {n.body}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {formatTime(n.createdAt)}
                                    </p>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
