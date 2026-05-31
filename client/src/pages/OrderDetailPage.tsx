import { Link, useParams } from "react-router-dom";
import { useOrder, useDownloadOrder, useDownloadCertificate } from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/price";
import type { OrderItem } from "@/types/order";

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
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
            <div className="mx-auto max-w-3xl px-6 py-8">
                <div className="h-8 w-40 animate-pulse rounded bg-muted" />
                <div className="mt-6 space-y-3">
                    {[0, 1].map((i) => (
                        <div key={i} className="h-24 w-full animate-pulse rounded-lg bg-muted" />
                    ))}
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="mx-auto max-w-3xl px-6 py-16 text-center">
                <p className="mb-4 text-destructive">Order not found.</p>
                <Link to="/orders">
                    <Button variant="outline" size="sm">
                        Back to purchase history
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl px-6 py-8">
            <Link
                to="/orders"
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
                ← Purchase history
            </Link>

            <div className="mt-2 mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Order #{order.id}</h1>
                    <p className="text-sm text-muted-foreground">
                        {formatDateTime(order.createdAt)}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className="rounded-md border px-2.5 py-1 text-xs">
                        {order.paymentStatus}
                    </span>
                    {order.paymentStatus === "COMPLETED" && (
                        <Button
                            size="sm"
                            onClick={() => download.mutate(orderId)}
                            disabled={download.isPending}
                        >
                            {download.isPending ? "Preparing…" : "Download (.zip)"}
                        </Button>
                    )}
                    {download.isError && (
                        <p className="text-xs text-destructive">
                            Download failed. Please try again.
                        </p>
                    )}
                </div>
            </div>

            <ul className="space-y-3">
                {order.orderItems.map((item) => {
                    const thumbnail = thumbnailOf(item);
                    return (
                        <li key={item.id} className="flex gap-4 rounded-lg border p-3">
                            <Link
                                to={`/assets/${item.asset.id}`}
                                className="h-20 w-20 shrink-0 overflow-hidden rounded bg-muted"
                            >
                                {thumbnail ? (
                                    <img
                                        src={thumbnail}
                                        alt={item.asset.title}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                        No preview
                                    </div>
                                )}
                            </Link>

                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <Link
                                    to={`/assets/${item.asset.id}`}
                                    className="truncate text-sm font-medium hover:underline"
                                >
                                    {item.asset.title}
                                </Link>
                                <p className="text-xs text-muted-foreground">
                                    {item.licenseType === "PERSONAL" ? "Personal" : "Commercial"} license
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    by {item.asset.seller.name}
                                </p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    License key:{" "}
                                    <span className="font-mono">{item.licenseKey}</span>
                                </p>
                                {order.paymentStatus === "COMPLETED" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-1 self-start"
                                        onClick={() =>
                                            certificate.mutate({
                                                orderId,
                                                itemId: item.id,
                                                licenseKey: item.licenseKey,
                                            })
                                        }
                                        disabled={
                                            certificate.isPending &&
                                            certificate.variables?.itemId === item.id
                                        }
                                    >
                                        {certificate.isPending &&
                                        certificate.variables?.itemId === item.id
                                            ? "Preparing…"
                                            : "Certificate (PDF)"}
                                    </Button>
                                )}
                            </div>

                            <div className="shrink-0 text-right text-sm font-semibold">
                                {formatPrice(item.price, order.currency)}
                            </div>
                        </li>
                    );
                })}
            </ul>

            <div className="mt-6 flex items-center justify-between rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xl font-semibold">
                    {formatPrice(order.totalAmount, order.currency)}
                </p>
            </div>
        </div>
    );
}
