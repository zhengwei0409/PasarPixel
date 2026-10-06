import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Download, FileCheck2, Package, ShieldCheck } from "lucide-react";
import { useOrder, useDownloadOrder, useDownloadCertificate } from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import OrderStatus from "@/components/orders/OrderStatus";
import { formatPrice } from "@/lib/price";
import type { OrderItem } from "@/types/order";

const pageClass = "orders-theme min-h-[calc(100dvh-73px)] bg-background text-foreground";
const linkClass = "inline-flex items-center gap-2 rounded-sm text-xs text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
}

function thumbnailOf(item: OrderItem): string | null {
    const file = item.asset.files.find((f) => f.fileType.startsWith("image/"));
    return file ? (file.previewUrl ?? file.fileUrl) : null;
}

export default function OrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const orderId = parseInt(id ?? "", 10);
    const { data: order, isLoading, error } = useOrder(orderId);
    const download = useDownloadOrder();
    const certificate = useDownloadCertificate();

    if (isLoading) {
        return (
            <main className={pageClass} aria-busy="true" aria-label="Loading order details">
                <div className="mx-auto max-w-[1104px] px-5 py-14 sm:px-8 lg:px-12">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                    <div className="mt-9 h-10 w-56 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
                        <div className="space-y-4">{[0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />)}</div>
                        <div className="h-72 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
                    </div>
                </div>
            </main>
        );
    }

    if (error || !order) {
        return (
            <main className={`${pageClass} px-5 py-24 text-center`}>
                <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-secondary text-[#7a8568]"><Package className="size-5" aria-hidden="true" /></div>
                <h1 className="text-2xl font-semibold tracking-tight">Order unavailable</h1>
                <p role="alert" className="mt-3 text-sm text-muted-foreground">We couldn’t find or load this order. Please return to your purchase history.</p>
                <Button asChild variant="outline" className="mt-6 h-10 gap-2 bg-white px-5"><Link to="/orders"><ArrowLeft className="size-4" aria-hidden="true" /> Purchase history</Link></Button>
            </main>
        );
    }

    const completed = order.paymentStatus === "COMPLETED";
    const itemCount = order.orderItems.length;

    return (
        <main className={pageClass}>
            <div className="mx-auto max-w-[1104px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
                <Link to="/orders" className={linkClass}><ArrowLeft className="size-3.5" aria-hidden="true" /> Purchase history</Link>
                <header className="mt-9 mb-10">
                    <p className="mb-3 text-[10px] font-medium tracking-[0.2em] text-[#7a8568]">ORDER DETAILS</p>
                    <div className="flex flex-wrap items-center gap-4"><h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Order #{order.id}<span className="text-[#7a8568]">.</span></h1><OrderStatus status={order.paymentStatus} /></div>
                    <p className="mt-3 text-sm text-muted-foreground">Placed on {formatDateTime(order.createdAt)}</p>
                </header>

                <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <section aria-labelledby="order-assets-heading" className="min-w-0">
                        <div className="mb-4 flex items-center justify-between gap-3"><h2 id="order-assets-heading" className="text-sm font-medium">Your assets</h2><span className="text-xs text-muted-foreground">{itemCount} {itemCount === 1 ? "asset" : "assets"}</span></div>
                        <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-white">
                            {order.orderItems.map((item) => {
                                const thumbnail = thumbnailOf(item);
                                const preparingCertificate = certificate.isPending && certificate.variables?.itemId === item.id;
                                return (
                                    <li key={item.id} className="p-5 sm:p-6">
                                        <div className="flex gap-4">
                                            <Link to={`/assets/${item.asset.id}`} aria-label={`View ${item.asset.title}`} className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary text-[#7a8568] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:size-24">
                                                {thumbnail ? <img src={thumbnail} alt={item.asset.title} loading="lazy" className="h-full w-full object-cover" /> : <Package className="size-6" aria-hidden="true" />}
                                            </Link>
                                            <div className="min-w-0 flex-1">
                                                <Link to={`/assets/${item.asset.id}`} className="rounded-sm text-sm font-medium break-words hover:text-[#657152] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{item.asset.title}</Link>
                                                <p className="mt-1 text-xs text-muted-foreground">by {item.asset.seller.name}</p>
                                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                                    <span className="rounded-md bg-secondary px-2 py-1 text-[11px] text-[#555e49]">{item.licenseType === "PERSONAL" ? "Personal" : "Commercial"} license</span>
                                                    <p className="text-sm font-semibold">{formatPrice(item.price, order.currency)}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-5 rounded-lg bg-[#f7f8f3] px-3.5 py-3">
                                            <p className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground">LICENSE KEY</p>
                                            <p className="mt-1.5 font-mono text-[11px] leading-5 break-all text-[#555e49]">{item.licenseKey}</p>
                                        </div>
                                        {completed && (
                                            <Button variant="outline" className="mt-3 h-9 gap-2 px-3 text-xs" onClick={() => certificate.mutate({ orderId, itemId: item.id, licenseKey: item.licenseKey })} disabled={certificate.isPending}>
                                                <FileCheck2 className="size-3.5" aria-hidden="true" /> {preparingCertificate ? "Preparing…" : "License certificate (PDF)"}
                                            </Button>
                                        )}
                                        {certificate.isError && certificate.variables?.itemId === item.id && <p role="alert" className="mt-2 text-xs text-destructive">Certificate download failed. Please try again.</p>}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>

                    <aside aria-labelledby="order-summary-heading" className="rounded-xl border bg-white p-6 lg:sticky lg:top-24">
                        <h2 id="order-summary-heading" className="text-sm font-medium">Order summary</h2>
                        <dl className="mt-6 space-y-4 text-xs">
                            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Order number</dt><dd>#{order.id}</dd></div>
                            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Assets</dt><dd>{itemCount}</dd></div>
                            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Currency</dt><dd>{order.currency}</dd></div>
                            <div className="flex items-baseline justify-between gap-3 border-t pt-5"><dt className="text-sm text-muted-foreground">Total</dt><dd className="text-2xl font-semibold tracking-tight">{formatPrice(order.totalAmount, order.currency)}</dd></div>
                        </dl>
                        {completed ? (
                            <>
                                <Button className="mt-6 h-11 w-full gap-2 text-xs hover:bg-[#444f3a]" onClick={() => download.mutate(orderId)} disabled={download.isPending}><Download className="size-4" aria-hidden="true" />{download.isPending ? "Preparing download…" : "Download all assets (.zip)"}</Button>
                                {download.isError && <p role="alert" className="mt-3 text-xs text-destructive">Download failed. Please try again.</p>}
                                <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="size-3.5 text-[#7a8568]" aria-hidden="true" /> License certificates available per asset</p>
                            </>
                        ) : <p className="mt-6 rounded-lg bg-secondary p-3 text-xs leading-5 text-muted-foreground">Downloads are available for completed orders.</p>}
                    </aside>
                </div>
                <div className="mt-10 border-t pt-6"><Link to="/marketplace" className={linkClass}>Find something for your next project <ArrowUpRight className="size-3.5" aria-hidden="true" /></Link></div>
            </div>
        </main>
    );
}
