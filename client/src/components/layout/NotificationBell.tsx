import { useState } from "react";
import { Popover } from "radix-ui";
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
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const { data: unreadCount = 0 } = useUnreadCount();
    const { data: notifications = [], isLoading } = useNotifications(open);
    const markAsRead = useMarkAsRead();
    const markAllAsRead = useMarkAllAsRead();

    const handleClickNotification = (n: Notification) => {
        if (!n.readAt) markAsRead.mutate(n.id);
        setExpandedId((prev) => (prev === n.id ? null : n.id));
    };

    const badge = unreadCount > 9 ? "9+" : String(unreadCount);

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative size-10 rounded-full text-[#657152] hover:bg-[#eef0e7] hover:text-[#30392b] data-[state=open]:bg-[#eef0e7] motion-reduce:transition-none"
                    aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                >
                    <Bell className="size-[18px]" aria-hidden="true" />
                    {unreadCount > 0 && (
                        <span aria-hidden="true" className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#657152] px-1 text-[9px] font-medium text-white ring-2 ring-[#fcfcfa]">
                            {badge}
                        </span>
                    )}
                </Button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content align="end" sideOffset={12} collisionPadding={16} aria-label="Notifications" className="z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-[#e7e9e1] bg-[#fcfcfa] text-[#252823] shadow-[0_12px_40px_-12px_rgba(37,40,35,0.2)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 data-[state=open]:duration-150 motion-reduce:animate-none">
                    <div className="flex items-center justify-between border-b border-[#e7e9e1] px-4 py-4">
                        <h3 className="text-sm font-medium">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={() => markAllAsRead.mutate()}
                                disabled={markAllAsRead.isPending}
                                className="cursor-pointer rounded-sm text-xs text-[#657152] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568] disabled:cursor-wait disabled:opacity-50"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[min(400px,60dvh)] overflow-y-auto rounded-b-xl">
                        {isLoading ? (
                            <p className="px-4 py-8 text-center text-sm text-[#73776e]">
                                Loading...
                            </p>
                        ) : notifications.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-[#73776e]">
                                No notifications yet
                            </p>
                        ) : (
                            notifications.map((n) => (
                                <button
                                    key={n.id}
                                    onClick={() => handleClickNotification(n)}
                                    aria-expanded={expandedId === n.id}
                                    className={`w-full cursor-pointer border-b border-[#e7e9e1] px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-[#e9ecdf] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#7a8568] motion-reduce:transition-none ${
                                        n.readAt ? "bg-[#fcfcfa]" : "bg-[#f0f3e9]"
                                    }`}
                                >
                                    <p className="text-sm font-medium">{n.title}</p>
                                    <p
                                        className={`mt-1 text-xs leading-relaxed text-[#73776e] ${
                                            expandedId === n.id ? "whitespace-pre-wrap" : "line-clamp-2"
                                        }`}
                                    >
                                        {n.body}
                                    </p>
                                    <p className="mt-2 text-[11px] text-[#85897f]">
                                        {formatTime(n.createdAt)}
                                    </p>
                                </button>
                            ))
                        )}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
