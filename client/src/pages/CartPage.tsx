import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCart, useUpdateCartItemLicense, useRemoveFromCart } from "@/hooks/useCart";
import { formatPrice, convertFiat } from "@/lib/price";
import type { CartItemWithAsset, LicenseType } from "@/types/cart";

function itemPrice(item: CartItemWithAsset): string | null {
    const asset = item.asset;
    const raw = item.licenseType === "PERSONAL" ? asset.pricePersonal : asset.priceCommercial;
    return raw;
}

function itemPriceUsd(item: CartItemWithAsset): number {
    const raw = itemPrice(item);
    if (raw === null) return 0;
    const n = parseFloat(raw);
    if (isNaN(n)) return 0;
    return convertFiat(n, item.asset.currency, "USD");
}

export default function CartPage() {
    const { data, isLoading, error } = useCart();
    const updateLicense = useUpdateCartItemLicense();
    const removeItem = useRemoveFromCart();

    if (isLoading) {
        return (
            <div className="mx-auto max-w-4xl px-6 py-8">
                <div className="h-8 w-40 animate-pulse rounded bg-muted" />
                <div className="mt-6 space-y-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-24 w-full animate-pulse rounded-lg bg-muted" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mx-auto max-w-4xl px-6 py-8">
                <p className="text-destructive">Failed to load your cart.</p>
            </div>
        );
    }

    const items = data?.items ?? [];

    if (items.length === 0) {
        return (
            <div className="mx-auto max-w-4xl px-6 py-16 text-center">
                <h1 className="mb-2 text-2xl font-semibold">Your cart is empty</h1>
                <p className="mb-6 text-muted-foreground">
                    Browse the marketplace and add assets to get started.
                </p>
                <Link to="/marketplace">
                    <Button>Browse marketplace</Button>
                </Link>
            </div>
        );
    }

    const subtotalUsd = items.reduce((sum, item) => sum + itemPriceUsd(item), 0);

    return (
        <div className="mx-auto max-w-4xl px-6 py-8">
            <h1 className="mb-6 text-2xl font-semibold">
                Cart <span className="text-muted-foreground">({items.length})</span>
            </h1>

            <ul className="space-y-3">
                {items.map((item) => {
                    const asset = item.asset;
                    const thumbnail = asset.files.find((f) => f.fileType.startsWith("image/"));
                    const hasPersonal = asset.pricePersonal !== null;
                    const hasCommercial = asset.priceCommercial !== null;

                    return (
                        <li
                            key={item.id}
                            className="flex gap-4 rounded-lg border p-3"
                        >
                            <Link
                                to={`/assets/${asset.id}`}
                                className="h-20 w-20 shrink-0 overflow-hidden rounded bg-muted"
                            >
                                {thumbnail ? (
                                    <img
                                        src={thumbnail.previewUrl ?? thumbnail.fileUrl}
                                        alt={asset.title}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                        No preview
                                    </div>
                                )}
                            </Link>

                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                                <div className="flex items-start justify-between gap-2">
                                    <Link
                                        to={`/assets/${asset.id}`}
                                        className="truncate text-sm font-medium hover:underline"
                                    >
                                        {asset.title}
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => removeItem.mutate(item.id)}
                                        disabled={removeItem.isPending}
                                        className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                                    >
                                        Remove
                                    </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    {(["PERSONAL", "COMMERCIAL"] as LicenseType[]).map((lt) => {
                                        const available =
                                            lt === "PERSONAL" ? hasPersonal : hasCommercial;
                                        return (
                                            <button
                                                key={lt}
                                                type="button"
                                                disabled={!available || updateLicense.isPending}
                                                onClick={() =>
                                                    updateLicense.mutate({
                                                        cartItemId: item.id,
                                                        licenseType: lt,
                                                    })
                                                }
                                                className={`rounded-md border px-2.5 py-1 text-xs transition ${
                                                    item.licenseType === lt
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border hover:border-foreground/30"
                                                } ${!available ? "cursor-not-allowed opacity-40" : ""}`}
                                            >
                                                {lt === "PERSONAL" ? "Personal" : "Commercial"}
                                            </button>
                                        );
                                    })}
                                </div>

                                <p className="text-sm font-semibold">
                                    {formatPrice(itemPrice(item), asset.currency)}
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ul>

            <div className="mt-6 flex items-center justify-between rounded-lg border p-4">
                <div>
                    <p className="text-xs text-muted-foreground">Subtotal</p>
                    <p className="text-xl font-semibold">{formatPrice(subtotalUsd, "USD")}</p>
                </div>
                <Button size="lg" disabled title="Checkout coming soon">
                    Checkout
                </Button>
            </div>
            <p className="mt-2 text-right text-xs text-muted-foreground">
                Checkout coming soon
            </p>
        </div>
    );
}
