import FloatingShapes from "@/components/home/FloatingShapes";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Layers } from "lucide-react";
import { useStore, useStoreAssets } from "@/hooks/useStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import AssetCard from "@/components/marketplace/AssetCard";

export default function StorePage() {
    const { sellerId: sellerIdParam } = useParams<{ sellerId: string }>();
    const sellerId = sellerIdParam ? Number(sellerIdParam) : NaN;
    const validId = Number.isSafeInteger(sellerId) && sellerId > 0;
    const { data: store, isLoading, error } = useStore(validId ? sellerId : null);
    const { data: assetsData, isLoading: assetsLoading, isError: assetsError, refetch: refetchAssets } = useStoreAssets(validId ? sellerId : null);
    const items = assetsData?.items ?? [];
    const initial = store?.storeName.charAt(0).toUpperCase() || "S";

    return (
        <main className="storefront-theme relative isolate min-h-[calc(100dvh-73px)] bg-background text-foreground">
            <FloatingShapes />
            <header className="relative z-10 overflow-hidden border-b border-border px-4 pt-6 pb-10 sm:px-8 sm:pt-8 sm:pb-12">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,#e3e8d8_0%,transparent_70%)]" />
                <div className="relative mx-auto max-w-[1008px]">
                    <Link to="/marketplace" className="mb-6 inline-flex items-center gap-2 rounded-sm text-xs font-medium text-[#657152] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]">
                        <ArrowLeft aria-hidden="true" className="size-3.5" />Back to marketplace
                    </Link>
                    {!validId ? (
                        <p role="alert" className="py-8 text-sm text-muted-foreground">Invalid store.</p>
                    ) : isLoading ? (
                        <div role="status" className="space-y-6">
                            <p className="sr-only">Loading store…</p>
                            <div aria-hidden="true" className="h-40 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none sm:h-56" />
                            <div aria-hidden="true" className="h-20 w-2/3 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
                        </div>
                    ) : error || !store ? (
                        <div role="alert" className="rounded-xl border border-border bg-white px-6 py-12 text-center">
                            <h1 className="text-xl font-semibold tracking-tight">Store unavailable</h1>
                            <p className="mt-2 text-sm text-muted-foreground">We couldn’t load this store. Please try again later.</p>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-2xl border border-border bg-background">
                            <div className="h-40 overflow-hidden bg-[#e9ecdf] sm:h-56 lg:h-64">
                                {store.bannerUrl ? (
                                    <img src={store.bannerUrl} alt={`${store.storeName} banner`} className="h-full w-full object-cover" />
                                ) : (
                                    <div aria-hidden="true" className="h-full w-full bg-[radial-gradient(ellipse_at_top_right,#c5cfb5_0%,#e3e8d8_45%,#eceee7_100%)]" />
                                )}
                            </div>
                            <div className="relative -mt-16 px-5 pb-6 sm:-mt-20 sm:px-8 sm:pb-8">
                                <Avatar className="size-32 border-[6px] border-background bg-background sm:size-40">
                                    {store.logoUrl && <AvatarImage src={store.logoUrl} alt={store.storeName} />}
                                    <AvatarFallback className="bg-secondary text-4xl font-medium text-[#657152]">{initial}</AvatarFallback>
                                </Avatar>
                                <div className="mt-5 min-w-0">
                                    <h1 className="break-words text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">{store.storeName}</h1>
                                    {store.description && <p className="mt-3 max-w-2xl whitespace-pre-line break-words text-sm leading-7 text-muted-foreground">{store.description}</p>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {validId && store && !isLoading && !error && (
                <section aria-labelledby="store-assets-heading" className="relative z-10 mx-auto max-w-[1104px] px-4 py-12 sm:px-8 sm:py-16 lg:px-12">
                    <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
                        <div>
                            <p className="mb-2 text-[10px] font-medium tracking-[0.2em] text-[#85897f]">THE COLLECTION</p>
                            <h2 id="store-assets-heading" className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Creative assets</h2>
                            <p className="mt-2 text-sm text-muted-foreground">Discover something for your next project.</p>
                        </div>
                        {!assetsLoading && !assetsError && <span className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? "asset" : "assets"}</span>}
                    </div>

                    {assetsError ? (
                        <div role="alert" className="rounded-xl border border-border bg-white p-8 text-center">
                            <p className="text-sm text-muted-foreground">We couldn’t load these assets. Please try again.</p>
                            <Button type="button" variant="outline" onClick={() => { void refetchAssets(); }} className="mt-4">Try again</Button>
                        </div>
                    ) : !assetsLoading && items.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[#c5cfb5] bg-white/70 px-6 py-14 text-center">
                            <Layers aria-hidden="true" className="mx-auto mb-4 size-8 stroke-1 text-[#7a8568]" />
                            <h3 className="text-lg font-medium tracking-tight">New creations are on their way</h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">This store has no listings yet. Check back soon.</p>
                            <Link to="/marketplace" className="mt-6 inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-[#657152] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]">Explore the marketplace<ArrowUpRight aria-hidden="true" className="size-3.5" /></Link>
                        </div>
                    ) : (
                        <div aria-busy={assetsLoading} className="grid gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-5">
                            {assetsLoading ? (
                                <>
                                    <p role="status" className="sr-only">Loading store assets…</p>
                                    {[0, 1, 2, 3].map((index) => (
                                        <div key={index} aria-hidden="true" className="overflow-hidden rounded-xl border border-[#e7e9e1] bg-white">
                                            <div className="aspect-[4/3] animate-pulse bg-[#e9ecdf] motion-reduce:animate-none" />
                                            <div className="space-y-3 p-4"><div className="h-3 w-3/4 rounded bg-[#eef0e7]" /><div className="h-2 w-1/2 rounded bg-[#eef0e7]" /></div>
                                        </div>
                                    ))}
                                </>
                            ) : items.map((asset) => (
                                <div key={asset.id} className="min-w-0"><AssetCard asset={asset} variant="compact" useCategoryIcon /></div>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </main>
    );
}
