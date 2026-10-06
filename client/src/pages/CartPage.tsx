import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Box, CreditCard, Download, Info, LockKeyhole, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, useUpdateCartItemLicense, useRemoveFromCart } from "@/hooks/useCart";
import { useCheckout } from "@/hooks/useCheckout";
import { formatPrice, convertFiat } from "@/lib/price";
import { useCurrencyStore } from "@/stores/currencyStore";
import type { AssetCategory, Currency } from "@/types/asset";
import type { CartItemWithAsset, LicenseType } from "@/types/cart";

const CATEGORY_LABELS: Record<AssetCategory, string> = {
    THREE_D_MODEL: "3D model",
    IMAGE: "Image",
    VIDEO: "Video",
    SOUND_EFFECT: "Audio",
    FONT: "Font",
    ANIMATION: "Animation",
};

const pageClass = "min-h-[calc(100dvh-73px)] bg-[#f7f7f2] text-[#252823]";
const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]";

function itemPrice(item: CartItemWithAsset): string | null {
    return item.licenseType === "PERSONAL" ? item.asset.pricePersonal : item.asset.priceCommercial;
}

function itemPriceIn(item: CartItemWithAsset, currency: Currency): number {
    const raw = itemPrice(item);
    if (raw === null) return 0;
    const n = parseFloat(raw);
    if (isNaN(n)) return 0;
    return convertFiat(n, item.asset.currency, currency);
}

export default function CartPage() {
    const { data, isLoading, error, refetch } = useCart();
    const updateLicense = useUpdateCartItemLicense();
    const removeItem = useRemoveFromCart();
    const checkout = useCheckout();
    const currency = useCurrencyStore((s) => s.displayCurrency);
    const cartBusy = updateLicense.isPending || removeItem.isPending || checkout.isPending;
    // Newly added assets are selected by default; deselections survive cart refetches.
    const [excludedItemIds, setExcludedItemIds] = useState<Set<number>>(() => new Set());
    const items = data?.items ?? [];
    const selectedItems = items.filter((item) => !excludedItemIds.has(item.id));
    const allSelected = items.length > 0 && selectedItems.length === items.length;

    function toggleItem(itemId: number) {
        setExcludedItemIds((previous) => {
            const next = new Set(previous);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    }

    function handleCheckout() {
        if (cartBusy || selectedItems.length === 0) return;
        checkout.mutate({ currency, cartItemIds: selectedItems.map((item) => item.id) }, {
            onSuccess: (url) => {
                window.location.href = url;
            },
        });
    }

    if (isLoading) {
        return (
            <main className={pageClass} aria-busy="true" aria-label="Loading your shopping cart">
                <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 lg:py-16">
                    <div className="h-9 w-64 animate-pulse rounded bg-[#e9ecdf] motion-reduce:animate-none" />
                    <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="space-y-6">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="h-44 animate-pulse rounded-xl bg-[#e9ecdf] motion-reduce:animate-none" />
                            ))}
                        </div>
                        <div className="h-96 animate-pulse rounded-xl bg-[#e9ecdf] motion-reduce:animate-none" />
                    </div>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className={`${pageClass} px-5 py-24 text-center`}>
                <h1 className="text-2xl font-semibold tracking-tight">Couldn’t load your cart</h1>
                <p role="alert" className="mt-3 text-sm text-[#73776e]">Please try again to see your saved assets.</p>
                <Button onClick={() => void refetch()} className="mt-6 h-11 bg-[#30392b] px-6 text-white hover:bg-[#444f3a]">Try again</Button>
            </main>
        );
    }

    if (items.length === 0) {
        return (
            <main className={`${pageClass} px-5 py-24 text-center sm:py-32`}>
                <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-[#e3e8d8] text-[#657152]">
                    <ShoppingBag className="size-8" aria-hidden="true" />
                </div>
                <p className="mb-3 text-[10px] font-medium tracking-[0.2em] text-[#74796c]">ROOM FOR YOUR NEXT GREAT FIND</p>
                <h1 className="text-3xl font-semibold tracking-[-0.04em]">Your cart is empty</h1>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#73776e]">Discover creative assets and find the perfect finishing touch for your next project.</p>
                <Button asChild className="mt-7 h-11 bg-[#30392b] px-6 text-white hover:bg-[#444f3a]">
                    <Link to="/marketplace">Explore the marketplace</Link>
                </Button>
            </main>
        );
    }

    const subtotal = selectedItems.reduce((sum, item) => sum + itemPriceIn(item, currency), 0);
    const totalLabel = formatPrice(subtotal, currency, currency, { zeroAsFree: false });

    return (
        <main className={pageClass}>
            <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14 lg:py-16">
                <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12 xl:gap-16">
                    <section aria-labelledby="cart-heading" className="min-w-0">
                        <h1 id="cart-heading" className="text-2xl font-semibold tracking-[-0.045em] sm:text-3xl">
                            Your Shopping Cart <span className="whitespace-nowrap">({items.length} {items.length === 1 ? "Item" : "Items"})</span>
                        </h1>
                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#73776e]">
                            <label className="inline-flex cursor-pointer items-center gap-2 py-2">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(input) => { if (input) input.indeterminate = selectedItems.length > 0 && !allSelected; }}
                                    disabled={cartBusy}
                                    onChange={(event) => setExcludedItemIds(event.target.checked ? new Set() : new Set(items.map((item) => item.id)))}
                                    className={`size-4 cursor-pointer rounded accent-[#657152] disabled:cursor-wait ${focusClass}`}
                                />
                                Select all
                            </label>
                            <p aria-live="polite">{selectedItems.length} of {items.length} selected</p>
                        </div>

                        <ul className="mt-3 space-y-4">
                            {items.map((item) => {
                                const asset = item.asset;
                                const thumbnail = asset.files.find((f) => f.purpose === "PREVIEW" && f.fileType.startsWith("image/"))
                                    ?? asset.files.find((f) => f.fileType.startsWith("image/"));

                                return (
                                    <li
                                        key={item.id}
                                        className={`grid grid-cols-[16px_64px_minmax(0,1fr)] items-center gap-3 rounded-xl border bg-white p-3 shadow-[0_4px_16px_-8px_rgba(37,40,35,0.12)] transition-colors motion-reduce:transition-none sm:grid-cols-[16px_128px_minmax(0,1fr)] sm:gap-5 sm:p-5 ${
                                            excludedItemIds.has(item.id) ? "border-[#dfe4d6]" : "border-[#a8b697]"
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            aria-label={`Select ${asset.title} for checkout`}
                                            checked={!excludedItemIds.has(item.id)}
                                            disabled={cartBusy}
                                            onChange={() => toggleItem(item.id)}
                                            className={`size-4 cursor-pointer rounded accent-[#657152] disabled:cursor-wait ${focusClass}`}
                                        />
                                        <Link to={`/assets/${asset.id}`} className={`aspect-square overflow-hidden rounded-lg bg-[#e9ecdf] ${focusClass}`} aria-label={`View ${asset.title}`}>
                                            {thumbnail ? (
                                                <img src={thumbnail.previewUrl ?? thumbnail.fileUrl} alt={asset.title} className="h-full w-full object-cover" loading="lazy" />
                                            ) : (
                                                <div className="flex h-full flex-col items-center justify-center gap-2 text-[#85897f]">
                                                    <Box className="size-7" aria-hidden="true" />
                                                    <span className="text-[10px]">No preview</span>
                                                </div>
                                            )}
                                        </Link>
                                        <div className="min-w-0">
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                                <h2 className="min-w-0 text-sm leading-6 font-semibold sm:text-base">
                                                    <Link to={`/assets/${asset.id}`} className={`rounded-sm hover:text-[#657152] ${focusClass}`}>{asset.title}</Link>
                                                </h2>
                                                <p className="shrink-0 text-base font-semibold tabular-nums">{formatPrice(itemPrice(item), asset.currency, currency)}</p>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[#73776e]">
                                                <select
                                                    aria-label={`License for ${asset.title}`}
                                                    value={item.licenseType}
                                                    disabled={cartBusy}
                                                    onChange={(event) => updateLicense.mutate({ cartItemId: item.id, licenseType: event.target.value as LicenseType })}
                                                    className="max-w-full cursor-pointer rounded-md border border-[#dfe4d6] bg-[#eceee7] px-2 py-1.5 text-[11px] text-[#555e49] focus-visible:outline-2 focus-visible:outline-[#7a8568] disabled:cursor-wait disabled:opacity-60"
                                                >
                                                    <option value="PERSONAL" disabled={asset.pricePersonal === null}>Personal License</option>
                                                    <option value="COMMERCIAL" disabled={asset.priceCommercial === null}>Commercial License</option>
                                                </select>
                                                <span className="hidden size-1 rounded-full bg-[#a0a499] sm:block" aria-hidden="true" />
                                                <span>{CATEGORY_LABELS[asset.category]}</span>
                                            </div>
                                            <button type="button" onClick={() => removeItem.mutate(item.id)} disabled={cartBusy} className={`mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-sm py-1 text-xs text-[#73776e] transition-colors hover:text-destructive disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none ${focusClass}`}>
                                                <Trash2 className="size-3.5" aria-hidden="true" />
                                                {removeItem.isPending && removeItem.variables === item.id ? "Removing…" : "Remove"}
                                                <span className="sr-only"> {asset.title}</span>
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        {(updateLicense.isError || removeItem.isError) && (
                            <p role="alert" className="mt-3 text-sm text-destructive">Could not {updateLicense.isError ? "update the license" : "remove the item"}. Please try again.</p>
                        )}
                        <Link to="/marketplace" className={`mt-6 inline-flex items-center gap-2 rounded-sm py-2 text-sm font-medium text-[#657152] hover:text-[#30392b] ${focusClass}`}>
                            <ArrowLeft className="size-4" aria-hidden="true" /> Continue Shopping
                        </Link>
                    </section>

                    <aside aria-labelledby="summary-heading" className="lg:sticky lg:top-8">
                        <div className="rounded-xl border border-[#e7e9e1] bg-white p-6 shadow-[0_16px_48px_-24px_rgba(37,40,35,0.15)] sm:p-7">
                            <h2 id="summary-heading" className="text-xl font-semibold tracking-[-0.035em]">Order Summary</h2>
                            <dl className="mt-7 space-y-4 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <dt className="text-[#73776e]">Subtotal <span className="text-xs">({selectedItems.length} {selectedItems.length === 1 ? "item" : "items"})</span></dt>
                                    <dd className="font-medium tabular-nums">{totalLabel}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <dt className="text-[#73776e]">Delivery</dt>
                                    <dd className="text-xs font-medium text-[#657152]">Digital download</dd>
                                </div>
                                <div className="flex items-center justify-between gap-3 border-t border-[#e7e9e1] pt-5">
                                    <dt className="font-semibold">Total <span className="text-xs font-normal text-[#85897f]">({currency})</span></dt>
                                    <dd className="text-2xl font-semibold tracking-tight tabular-nums" aria-live="polite">{totalLabel}</dd>
                                </div>
                            </dl>
                            <Button size="lg" onClick={handleCheckout} disabled={cartBusy || selectedItems.length === 0} className="mt-6 h-12 w-full gap-2 rounded-lg bg-[#30392b] text-white hover:bg-[#444f3a] focus-visible:ring-[#7a8568]/40">
                                <LockKeyhole className="size-4" aria-hidden="true" />
                                {checkout.isPending ? "Redirecting…" : "Secure Checkout"}
                            </Button>
                            {selectedItems.length === 0 && <p className="mt-3 text-center text-xs text-[#73776e]">Select at least one asset to check out.</p>}
                            {checkout.isError && <p role="alert" className="mt-3 text-xs leading-5 text-destructive">Could not start checkout. Please try again.</p>}
                            <p className="mt-4 text-center text-[9px] font-medium tracking-[0.14em] text-[#85897f]">SECURE PAYMENTS POWERED BY STRIPE</p>
                            <div className="mt-3 flex items-center justify-center gap-5 text-[#85897f]" aria-hidden="true">
                                <CreditCard className="size-5" />
                                <LockKeyhole className="size-5" />
                                <ShieldCheck className="size-5" />
                            </div>
                            <div className="mt-7 flex items-start gap-3 rounded-lg bg-[#f2f4ed] p-4">
                                <Info className="mt-0.5 size-4 shrink-0 text-[#657152]" aria-hidden="true" />
                                <div>
                                    <h3 className="text-xs font-medium">Instant Digital Delivery</h3>
                                    <p className="mt-1 text-[11px] leading-[1.6] text-[#73776e]">Your assets will be available in your purchase history after payment is complete.</p>
                                </div>
                            </div>
                        </div>
                        <p className="mt-5 flex items-center justify-center gap-2 text-xs text-[#85897f]">
                            <Download className="size-3.5" aria-hidden="true" /> Great finds. Ready for your next idea.
                        </p>
                    </aside>
                </div>
            </div>
            <footer className="border-t border-[#e7e9e1] px-5 py-7 sm:px-8">
                <p className="mx-auto max-w-[1136px] text-xs text-[#85897f]">PasarPixel <span className="mx-2 text-[#c5cfb5]">/</span> Creative assets. New possibilities.</p>
            </footer>
        </main>
    );
}
