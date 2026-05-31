import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useOrders } from "@/hooks/useOrders";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Order, PaymentStatus } from "@/types/order";

const STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
    { value: "COMPLETED", label: "Completed" },
    { value: "PENDING", label: "Pending" },
    { value: "FAILED", label: "Failed" },
    { value: "REFUNDED", label: "Refunded" },
];

// Default view shows only what the buyer actually bought.
const DEFAULT_STATUS: PaymentStatus = "COMPLETED";
const PAGE_SIZE = 20;

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function orderItemCount(order: Order): string {
    const n = order.orderItems.length;
    return `${n} ${n === 1 ? "item" : "items"}`;
}

// The order's currency isn't persisted on the row, so show the stored numeric
// amount with 2dp and no assumed symbol (it's whatever was paid at checkout).
function formatAmount(value: string): string {
    const n = parseFloat(value);
    if (isNaN(n)) return "—";
    return n.toFixed(2);
}

export default function PurchaseHistoryPage() {
    const [keyword, setKeyword] = useState("");
    const [status, setStatus] = useState<PaymentStatus>(DEFAULT_STATUS);
    const [page, setPage] = useState(1);

    const debouncedKeyword = useDebounce(keyword, 300);

    // Reset to page 1 whenever the filters change (same pattern as MarketplacePage).
    const filterKey = JSON.stringify([debouncedKeyword, status]);
    const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
    if (filterKey !== prevFilterKey) {
        setPrevFilterKey(filterKey);
        setPage(1);
    }

    const params = useMemo(() => {
        const p: Record<string, unknown> = {
            paymentStatus: status,
            page,
            pageSize: PAGE_SIZE,
        };
        if (debouncedKeyword.trim()) p.keyword = debouncedKeyword.trim();
        return p;
    }, [debouncedKeyword, status, page]);

    const { data, isLoading, error } = useOrders(params);

    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

    return (
        <div className="mx-auto max-w-4xl px-6 py-8">
            <h1 className="mb-6 text-2xl font-semibold">Purchase History</h1>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
                <Input
                    placeholder="Search by asset title..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                />
                <Select value={status} onValueChange={(v) => setStatus(v as PaymentStatus)}>
                    <SelectTrigger className="sm:w-44">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {isLoading && (
                <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-20 w-full animate-pulse rounded-lg bg-muted" />
                    ))}
                </div>
            )}

            {error && <p className="text-destructive">Failed to load your orders.</p>}

            {data && data.items.length === 0 && (
                <div className="rounded-lg border py-16 text-center">
                    <p className="mb-2 text-muted-foreground">No orders found.</p>
                    <Link to="/marketplace">
                        <Button variant="outline" size="sm">
                            Browse marketplace
                        </Button>
                    </Link>
                </div>
            )}

            {data && data.items.length > 0 && (
                <>
                    <ul className="space-y-3">
                        {data.items.map((order) => (
                            <li key={order.id}>
                                <Link
                                    to={`/orders/${order.id}`}
                                    className="flex items-center justify-between gap-4 rounded-lg border p-4 transition hover:border-foreground/30"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">Order #{order.id}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDate(order.createdAt)} · {orderItemCount(order)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold">
                                            {formatAmount(order.totalAmount)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {order.paymentStatus}
                                        </p>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {totalPages > 1 && (
                        <div className="mt-8 flex items-center justify-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                            >
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {page} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
