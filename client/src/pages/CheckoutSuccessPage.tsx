import FloatingShapes from "@/components/home/FloatingShapes";
import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Box, Check, CircleCheck, Download, FileText, Info, LoaderCircle, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDownloadCertificate, useDownloadOrder, useDownloadOrderItem, useDownloadReceipt } from "@/hooks/useOrders";
import { useSubmitReview } from "@/hooks/useAsset";
import { formatPrice } from "@/lib/price";
import { verifyCheckout } from "@/services/checkoutService";
import { getOrderById } from "@/services/orderService";
import type { OrderItem } from "@/types/order";

const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]";
const primaryButton = "bg-[#30392b] text-white hover:bg-[#444f3a] focus-visible:ring-[#7a8568]/40";
const secondaryButton = "border-[#dfe4d6] bg-[#eceee7] text-[#555e49] hover:bg-[#e3e8d8] focus-visible:ring-[#7a8568]/40";

function PurchasedAssetCard({ item, orderId, buyerId }: { item: OrderItem; orderId: number; buyerId: number }) {
    const download = useDownloadOrderItem();
    const certificate = useDownloadCertificate();
    const review = useSubmitReview();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const reviewRestriction = item.asset.sellerId === buyerId
        ? "You can’t review your own asset. Reviews are available for assets you purchase from other sellers."
        : item.asset.isDeleted || item.asset.status !== "PUBLISHED"
            ? "Reviews are unavailable because this asset is no longer published."
            : null;
    const responseError = axios.isAxiosError<{ error?: string }>(review.error) ? review.error.response?.data?.error : undefined;
    const reviewError = review.isError
        ? typeof responseError === "string" ? responseError : "Could not save your review. Please try again."
        : null;
    const thumbnail = item.asset.files.find((file) => file.purpose === "PREVIEW" && file.fileType.startsWith("image/"))
        ?? item.asset.files.find((file) => file.fileType.startsWith("image/"));

    return (
        <li className="rounded-xl border border-[#e7e9e1] bg-white p-4 shadow-[0_8px_24px_-20px_rgba(37,40,35,0.2)] sm:p-5">
            <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-5">
                <Link to={`/assets/${item.assetId}`} className={`aspect-square overflow-hidden rounded-md bg-[#e9ecdf] ${focusClass}`} aria-label={`View ${item.asset.title}`}>
                    {thumbnail ? (
                        <img src={thumbnail.previewUrl ?? thumbnail.fileUrl} alt={item.asset.title} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                        <div className="flex h-full items-center justify-center text-[#85897f]"><Box className="size-7" aria-hidden="true" /></div>
                    )}
                </Link>
                <div className="min-w-0">
                    <h3 className="text-sm leading-5 font-semibold sm:text-base">
                        <Link to={`/assets/${item.assetId}`} className={`rounded-sm hover:text-[#657152] ${focusClass}`}>{item.asset.title}</Link>
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-[#73776e]">{item.licenseType === "PERSONAL" ? "Personal" : "Commercial"} license <span aria-hidden="true">·</span> by {item.asset.seller.name}</p>
                    <Button onClick={() => download.mutate({ orderId, itemId: item.id })} disabled={download.isPending} className={`mt-3 h-10 w-full gap-2 rounded-md text-xs ${primaryButton}`}>
                        <Download className="size-3.5" aria-hidden="true" />{download.isPending ? "Preparing download…" : "Download Asset"}
                    </Button>
                    {download.isError && <p role="alert" className="mt-2 text-xs text-destructive">Download failed. Please try again.</p>}
                    <button type="button" onClick={() => certificate.mutate({ orderId, itemId: item.id, licenseKey: item.licenseKey })} disabled={certificate.isPending} className={`mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-sm py-1 text-[11px] text-[#657152] hover:underline disabled:opacity-50 ${focusClass}`}>
                        <FileText className="size-3" aria-hidden="true" />{certificate.isPending ? "Preparing certificate…" : "License certificate (PDF)"}
                    </button>
                    {certificate.isError && <p role="alert" className="mt-1 text-xs text-destructive">Could not download the certificate. Please try again.</p>}
                </div>
                {reviewRestriction ? (
                    <div className="col-span-2 border-t border-[#e7e9e1] pt-4 sm:col-span-1 sm:col-start-2">
                        <p className="text-xs font-medium">Reviews</p>
                        <p className="mt-2 text-xs leading-5 text-[#73776e]">{reviewRestriction}</p>
                    </div>
                ) : <form
                    className="col-span-2 border-t border-[#e7e9e1] pt-4 sm:col-span-1 sm:col-start-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (rating === 0 || review.isPending) return;
                        review.mutate({ assetId: item.assetId, payload: { rating, comment: comment.trim() || undefined } });
                    }}
                >
                    <fieldset disabled={review.isPending}>
                        <legend className="text-xs font-medium">Leave a Review</legend>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((value) => (
                                    <label key={value} className="relative cursor-pointer rounded-sm text-[#7a8568] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#7a8568]">
                                        <input type="radio" name={`rating-${item.id}`} value={value} checked={rating === value} onChange={() => { setRating(value); review.reset(); }} aria-label={`${value} ${value === 1 ? "star" : "stars"} for ${item.asset.title}`} className="sr-only" />
                                        <Star className={`size-5 ${value <= rating ? "fill-[#7a8568]" : "fill-transparent"}`} aria-hidden="true" />
                                    </label>
                                ))}
                            </div>
                            <span className="text-[10px] text-[#85897f]">{rating ? `${rating} of 5 stars` : "Select rating"}</span>
                        </div>
                        <label htmlFor={`comment-${item.id}`} className="sr-only">Review comment for {item.asset.title} (optional)</label>
                        <textarea id={`comment-${item.id}`} value={comment} maxLength={2000} onChange={(event) => { setComment(event.target.value); review.reset(); }} placeholder="Share your thoughts on this asset…" rows={3} className="mt-3 w-full resize-y rounded-md border border-[#e7e9e1] bg-[#f7f7f2] px-3 py-2 text-xs leading-5 text-[#252823] placeholder:text-[#a0a499] focus-visible:outline-2 focus-visible:outline-[#7a8568]" />
                        <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="max-w-36 text-[9px] leading-4 tracking-[0.04em] text-[#85897f]">A star rating is required.<br />Your comment is optional.</p>
                            <Button type="submit" variant="outline" disabled={rating === 0 || review.isPending || review.isSuccess} className={`h-9 px-3 text-[11px] ${secondaryButton}`}>
                                {review.isPending ? "Submitting…" : review.isSuccess ? "Review Saved" : "Submit Review"}
                            </Button>
                        </div>
                    </fieldset>
                    {review.isSuccess && <p role="status" className="mt-2 flex items-center gap-1 text-xs text-[#657152]"><Check className="size-3" aria-hidden="true" />Thank you! Your review has been saved.</p>}
                    {reviewError && <p role="alert" className="mt-2 text-xs text-destructive">{reviewError}</p>}
                </form>}
            </div>
        </li>
    );
}

export default function CheckoutSuccessPage() {
    const [params] = useSearchParams();
    const orderId = Number(params.get("orderId"));
    const validOrderId = Number.isSafeInteger(orderId) && orderId > 0;
    const queryClient = useQueryClient();
    const downloadAll = useDownloadOrder();
    const receipt = useDownloadReceipt();
    const verification = useQuery({
        queryKey: ["checkout", "verify", orderId],
        queryFn: () => verifyCheckout(orderId),
        enabled: validOrderId,
        refetchInterval: (query) => query.state.data && query.state.data !== "PENDING" ? false : 2000,
    });
    const status = verification.data;
    const completed = status === "COMPLETED";
    const orderQuery = useQuery({
        queryKey: ["orders", orderId],
        queryFn: () => getOrderById(orderId),
        enabled: validOrderId && completed,
    });
    const order = orderQuery.data;

    useEffect(() => {
        if (status && status !== "PENDING") {
            void queryClient.invalidateQueries({ queryKey: ["cart"] });
            void queryClient.invalidateQueries({ queryKey: ["orders"] });
        }
    }, [status, queryClient]);

    const failed = status === "FAILED" || status === "REFUNDED";
    const hasError = !validOrderId || verification.isError;
    const title = hasError ? "Unable to confirm your order" : failed ? (status === "REFUNDED" ? "Order refunded" : "Payment not completed") : completed ? "Thank You." : "Confirming your payment…";
    const description = hasError
        ? "Please check your purchase history or try confirming your payment again."
        : failed ? "You can view your order details in your purchase history."
        : completed ? "Your order has been processed successfully. Your creative assets are ready to download and bring your next idea to life."
        : "We’re checking your payment. Your downloads will be ready as soon as it’s confirmed.";

    return (
        <main className="relative isolate min-h-[calc(100dvh-73px)] bg-[#f7f7f2] text-[#252823]">
            <FloatingShapes />
            <div className="relative z-10">
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_50%_0%,#e3e8d8_0%,transparent_70%)]" />
                <div className="mx-auto max-w-[1040px] px-5 pt-10 pb-16 sm:px-8 sm:pt-14 sm:pb-20">
                    <header className="mx-auto max-w-lg text-center" aria-live="polite">
                        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl bg-[#e3e8d8] text-[#657152]">
                            {completed ? <CircleCheck className="size-6" aria-hidden="true" /> : hasError || failed ? <Info className="size-6" aria-hidden="true" /> : <LoaderCircle className="size-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                        </div>
                        <h1 className="text-3xl leading-tight font-semibold tracking-[-0.055em] sm:text-5xl">{title}</h1>
                        <p className="mt-3 text-sm leading-6 text-[#73776e]">{description}</p>
                        {validOrderId && completed && (
                            <div className="mt-6 inline-flex flex-col gap-1 rounded-md border border-[#dfe4d6] bg-[#eceee7] px-5 py-3">
                                <span className="text-[9px] tracking-[0.15em] text-[#73776e]">ORDER CONFIRMATION</span>
                                <span className="text-sm font-semibold tracking-wide text-[#555e49]">#{String(orderId).padStart(6, "0")}</span>
                            </div>
                        )}
                        {hasError || failed ? (
                            <div className="mt-6 flex flex-wrap justify-center gap-3">
                                {validOrderId && verification.isError && <Button onClick={() => void verification.refetch()} className={`h-10 px-5 ${primaryButton}`}>Try Again</Button>}
                                <Button asChild variant="outline" className={`h-10 px-5 ${secondaryButton}`}><Link to="/orders">Purchase History</Link></Button>
                            </div>
                        ) : null}
                    </header>

                    {completed && orderQuery.isPending && (
                        <div className="mt-12 grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]" aria-busy="true" aria-label="Loading your purchased assets">
                            <div className="space-y-5">{[0, 1].map((index) => <div key={index} className="h-64 animate-pulse rounded-xl bg-[#e9ecdf] motion-reduce:animate-none" />)}</div>
                            <div className="h-96 animate-pulse rounded-xl bg-[#e9ecdf] motion-reduce:animate-none" />
                        </div>
                    )}
                    {completed && orderQuery.isError && (
                        <div className="mt-12 rounded-xl border border-[#dfe4d6] bg-white p-6 text-center">
                            <p role="alert" className="text-sm text-[#73776e]">Your payment is confirmed, but we couldn’t load your order details.</p>
                            <Button onClick={() => void orderQuery.refetch()} className={`mt-4 h-10 px-5 ${primaryButton}`}>Reload Order</Button>
                        </div>
                    )}
                    {completed && order && order.paymentStatus === "COMPLETED" && (
                        <div className="mt-10 grid items-start gap-7 md:mt-12 md:grid-cols-[minmax(0,1fr)_300px] md:gap-8 lg:gap-10">
                            <section aria-labelledby="purchased-heading" className="min-w-0">
                                <div className="mb-5 flex items-center justify-between gap-3">
                                    <h2 id="purchased-heading" className="text-lg font-semibold tracking-tight">Your Purchased Assets</h2>
                                    <span className="text-xs text-[#85897f]">{order.orderItems.length} {order.orderItems.length === 1 ? "Item" : "Items"}</span>
                                </div>
                                <ul className="space-y-5">{order.orderItems.map((item) => <PurchasedAssetCard key={item.id} item={item} orderId={orderId} buyerId={order.buyerId} />)}</ul>
                                <Link to="/marketplace" className={`mt-6 inline-flex items-center gap-2 rounded-sm py-2 text-xs font-medium text-[#657152] hover:text-[#30392b] ${focusClass}`}><ArrowLeft className="size-4" aria-hidden="true" />Continue Shopping</Link>
                            </section>
                            <aside aria-labelledby="receipt-heading" className="rounded-xl border border-[#dfe4d6] bg-[#eceee7]/70 p-6 md:sticky md:top-8">
                                <h2 id="receipt-heading" className="text-lg font-semibold tracking-tight">Order Receipt</h2>
                                <dl className="mt-5 space-y-4 text-xs">
                                    <div className="flex justify-between gap-4"><dt className="text-[#73776e]">Date</dt><dd className="text-right">{new Date(order.createdAt).toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "long", day: "numeric" })}</dd></div>
                                    <div className="flex justify-between gap-4"><dt className="text-[#73776e]">Payment Status</dt><dd className="flex items-center gap-1 text-[#657152]"><Check className="size-3" aria-hidden="true" />Paid</dd></div>
                                    <div className="flex justify-between gap-4 border-t border-[#dfe4d6] pt-4"><dt className="text-[#73776e]">Subtotal</dt><dd className="font-medium tabular-nums">{formatPrice(order.totalAmount, order.currency, order.currency, { zeroAsFree: false })}</dd></div>
                                    <div className="flex justify-between gap-4"><dt className="text-[#73776e]">Delivery</dt><dd className="text-[#657152]">Digital download</dd></div>
                                    <div className="flex items-center justify-between gap-4 border-t border-[#dfe4d6] pt-5"><dt className="text-sm font-semibold">Total Amount</dt><dd className="text-xl font-semibold tabular-nums text-[#555e49]">{formatPrice(order.totalAmount, order.currency, order.currency, { zeroAsFree: false })}</dd></div>
                                </dl>
                                <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-white/85 p-3.5">
                                    <Info className="mt-0.5 size-4 shrink-0 text-[#657152]" aria-hidden="true" />
                                    <p className="text-[11px] leading-5 text-[#73776e]">Your assets, receipt, and license certificates are ready here. You can download your assets again from your purchase history.</p>
                                </div>
                                <Button onClick={() => receipt.mutate(orderId)} disabled={receipt.isPending} className="mt-5 h-11 w-full gap-2 border border-[#c5cfb5] bg-[#e3e8d8] text-xs text-[#30392b] hover:bg-[#d6dec9] focus-visible:ring-[#7a8568]/40"><FileText className="size-4" aria-hidden="true" />{receipt.isPending ? "Preparing Receipt…" : "Download Receipt (PDF)"}</Button>
                                {receipt.isError && <p role="alert" className="mt-2 text-xs text-destructive">Could not download the receipt. Please try again.</p>}
                                <Button onClick={() => downloadAll.mutate(orderId)} disabled={downloadAll.isPending} className={`mt-3 h-11 w-full gap-2 text-xs ${primaryButton}`}><Download className="size-4" aria-hidden="true" />{downloadAll.isPending ? "Preparing Downloads…" : "Download All Assets (.zip)"}</Button>
                                {downloadAll.isError && <p role="alert" className="mt-2 text-xs text-destructive">Download failed. Please try again.</p>}
                                <Link to={`/orders/${orderId}`} className={`mt-5 flex items-center justify-center gap-1.5 rounded-sm text-xs text-[#73776e] underline underline-offset-4 hover:text-[#30392b] ${focusClass}`}>View Order Details<ArrowUpRight className="size-3" aria-hidden="true" /></Link>
                                <p className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-[#85897f]"><ShieldCheck className="size-3.5" aria-hidden="true" />Secure payment through Stripe</p>
                            </aside>
                        </div>
                    )}
                </div>
                <footer className="border-t border-[#e7e9e1] px-5 py-6 text-center text-xs text-[#85897f]">PasarPixel <span className="mx-2 text-[#c5cfb5]">/</span> Creative assets. New possibilities.</footer>
            </div>
        </main>
    );
}
