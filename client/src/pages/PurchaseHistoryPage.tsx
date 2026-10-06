import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Package, Search } from "lucide-react";
import { useOrders } from "@/hooks/useOrders";
import { useDebounce } from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import OrderStatus from "@/components/orders/OrderStatus";
import { formatPrice } from "@/lib/price";
import type { Order, PaymentStatus } from "@/types/order";

const STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
    { value: "COMPLETED", label: "Completed" },
    { value: "PENDING", label: "Pending" },
    { value: "FAILED", label: "Failed" },
];
const PAGE_SIZE = 20;

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function orderItemCount(order: Order): string {
    const n = order.orderItems.length;
    return `${n} ${n === 1 ? "asset" : "assets"}`;
}

export default function PurchaseHistoryPage() {
    const [keyword, setKeyword] = useState("");
    const [status, setStatus] = useState<PaymentStatus>("COMPLETED");
    const [page, setPage] = useState(1);
    const debouncedKeyword = useDebounce(keyword, 300);
    const filterKey = JSON.stringify([debouncedKeyword, status]);
    const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
    if (filterKey !== prevFilterKey) {
        setPrevFilterKey(filterKey);
        setPage(1);
    }

    const params = useMemo(() => ({
        paymentStatus: status,
        page,
        pageSize: PAGE_SIZE,
        ...(debouncedKeyword.trim() ? { keyword: debouncedKeyword.trim() } : {}),
    }), [debouncedKeyword, status, page]);
    const { data, isLoading, error, refetch } = useOrders(params);
    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
    const hasSearch = Boolean(debouncedKeyword.trim());

    return (
        <main className="orders-theme min-h-[calc(100dvh-73px)] bg-background text-foreground">
            <div className="mx-auto max-w-[1104px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
                <Link to="/marketplace" className="inline-flex items-center gap-2 rounded-sm text-xs text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                    <ArrowLeft className="size-3.5" aria-hidden="true" /> Marketplace
                </Link>
                <header className="mt-9 mb-10 flex flex-wrap items-end justify-between gap-5">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Purchase history<span className="text-[#7a8568]">.</span></h1>
                    </div>
                </header>

                <div className="mb-7 flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#85897f]" aria-hidden="true" />
                        <Input type="search" aria-label="Search orders by asset title" placeholder="Search by asset title…" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="h-11 rounded-lg bg-white pl-10 text-sm shadow-none" />
                    </div>
                    <Select value={status} onValueChange={(value) => setStatus(value as PaymentStatus)}>
                        <SelectTrigger aria-label="Filter orders by payment status" className="h-11! w-full rounded-lg bg-white px-4 shadow-none sm:w-44">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="orders-theme bg-popover text-popover-foreground">
                            {STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                {isLoading && (
                    <div role="status" aria-label="Loading orders" className="space-y-3">
                        {[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />)}
                    </div>
                )}
                {error && (
                    <div role="alert" className="rounded-xl border bg-white px-6 py-12 text-center">
                        <h2 className="text-lg font-medium">Couldn’t load your orders</h2>
                        <p className="mt-2 text-sm text-muted-foreground">Please try again to see your purchase history.</p>
                        <Button onClick={() => void refetch()} className="mt-5 h-10 px-5 hover:bg-[#444f3a]">Try again</Button>
                    </div>
                )}
                {!error && data && data.items.length === 0 && (
                    <div className="rounded-xl border border-dashed bg-white/60 px-6 py-16 text-center">
                        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-secondary text-[#7a8568]"><Package className="size-5" aria-hidden="true" /></div>
                        <h2 className="text-lg font-medium tracking-tight">{hasSearch ? "No matching orders" : `No ${status.toLowerCase()} orders yet`}</h2>
                        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{hasSearch ? "Try a different asset title or change the status filter." : "Explore the marketplace to find something for your next project."}</p>
                        <Button asChild className="mt-6 h-10 gap-2 px-5 hover:bg-[#444f3a]"><Link to="/marketplace">Browse marketplace <ArrowUpRight className="size-3.5" aria-hidden="true" /></Link></Button>
                    </div>
                )}
                {!error && data && data.items.length > 0 && (
                    <>
                        <div className="mb-3 flex items-center justify-between px-1 text-xs text-muted-foreground">
                            <p>{data.total} {data.total === 1 ? "order" : "orders"}</p>
                            <p>Most recent first</p>
                        </div>
                        <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-white">
                            {data.items.map((order) => (
                                <li key={order.id}>
                                    <Link to={`/orders/${order.id}`} className="group grid gap-4 px-5 py-5 transition-colors hover:bg-[#f4f6ef] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6 sm:py-6">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-3"><h2 className="text-sm font-semibold">Order #{order.id}</h2><OrderStatus status={order.paymentStatus} /></div>
                                            <p className="mt-2 text-xs text-muted-foreground">{formatDate(order.createdAt)} <span className="mx-1.5 text-[#b7bead]">·</span> {orderItemCount(order)}</p>
                                            <p className="mt-2 truncate text-xs text-[#555e49]">{order.orderItems.map((item) => item.asset.title).join(", ")}</p>
                                        </div>
                                        <div className="flex items-center justify-between gap-6 sm:justify-end">
                                            <div className="sm:text-right"><p className="text-base font-semibold tracking-tight">{formatPrice(order.totalAmount, order.currency)}</p><p className="mt-1 text-[11px] text-muted-foreground">Order total</p></div>
                                            <ArrowUpRight className="size-4 text-[#7a8568] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" aria-hidden="true" />
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        {totalPages > 1 && (
                            <nav aria-label="Purchase history pagination" className="mt-7 flex items-center justify-between gap-3">
                                <Button variant="outline" className="h-10 gap-1.5 bg-transparent px-3 text-xs" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}><ChevronLeft className="size-3.5" aria-hidden="true" /> Previous</Button>
                                <span className="text-xs text-muted-foreground" aria-live="polite">Page {page} of {totalPages}</span>
                                <Button variant="outline" className="h-10 gap-1.5 bg-transparent px-3 text-xs" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next <ChevronRight className="size-3.5" aria-hidden="true" /></Button>
                            </nav>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
