import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import AssetCard from "@/components/marketplace/AssetCard";
import { Button } from "@/components/ui/button";
import { useBrowseAssets } from "@/hooks/useAsset";
import { cn } from "@/lib/utils";
import type { BrowseSort } from "@/types/asset";

interface AssetSectionProps {
    title: string;
    eyebrow: string;
    description: string;
    sort: BrowseSort;
    layout: "grid" | "scroller";
    limit: number;
}

export default function AssetSection({ title, eyebrow, description, sort, layout, limit }: AssetSectionProps) {
    const { data, isPending, isError, refetch } = useBrowseAssets({ sort, page: 1, pageSize: limit });
    const scrollerRef = useRef<HTMLDivElement>(null);
    const headingId = `home-${sort}`;
    const scroll = (direction: number) => {
        const scroller = scrollerRef.current;
        if (!scroller) return;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        scroller.scrollBy({ left: direction * scroller.clientWidth * 0.8, behavior: reducedMotion ? "auto" : "smooth" });
    };

    return (
        <section aria-labelledby={headingId}>
            <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
                <div>
                    <p className="mb-2 text-[10px] font-medium tracking-[0.2em] text-[#85897f]">{eyebrow}</p>
                    <h2 id={headingId} className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{title}</h2>
                    <p className="mt-2 text-sm text-[#73776e]">{description}</p>
                </div>
                <div className="flex items-center gap-4">
                    {layout === "scroller" && !isPending && !isError && (data?.items.length ?? 0) > 0 && (
                        <div className="hidden items-center gap-2 sm:flex">
                            <Button variant="outline" size="icon" onClick={() => scroll(-1)} aria-label="Scroll new releases left" aria-controls={`${headingId}-list`} className="size-8 border-[#e2e5dc] bg-transparent text-[#657152] hover:bg-[#eef0e7] motion-reduce:transition-none"><ChevronLeft className="size-4" aria-hidden="true" /></Button>
                            <Button variant="outline" size="icon" onClick={() => scroll(1)} aria-label="Scroll new releases right" aria-controls={`${headingId}-list`} className="size-8 border-[#e2e5dc] bg-transparent text-[#657152] hover:bg-[#eef0e7] motion-reduce:transition-none"><ChevronRight className="size-4" aria-hidden="true" /></Button>
                        </div>
                    )}
                    <Link to={`/marketplace?sort=${sort}`} className="group inline-flex items-center gap-2 rounded-sm text-xs font-medium text-[#555e49] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]">
                        View more
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none" aria-hidden="true" />
                    </Link>
                </div>
            </div>

            {isPending && <p role="status" className="sr-only">Loading {title.toLowerCase()} assets…</p>}
            {isError ? (
                <div role="alert" className="rounded-xl border border-[#e7e9e1] bg-white p-8 text-center">
                    <p className="text-sm text-[#73776e]">We couldn’t load these assets. Please try again.</p>
                    <Button variant="outline" onClick={() => { void refetch(); }} className="mt-4 border-[#e2e5dc] text-[#555e49]">Try again</Button>
                </div>
            ) : !isPending && data?.items.length === 0 ? (
                <div className="rounded-xl border border-[#e7e9e1] bg-white p-10 text-center text-sm text-[#73776e]">
                    {sort === "best_selling" ? "Best sellers will appear here as purchases come in." : "Fresh finds are on their way. Check back soon."}
                </div>
            ) : (
                <div
                    id={`${headingId}-list`}
                    ref={scrollerRef}
                    role={layout === "scroller" ? "region" : undefined}
                    aria-label={layout === "scroller" ? "New releases; scroll to explore" : undefined}
                    aria-busy={isPending}
                    tabIndex={layout === "scroller" ? 0 : undefined}
                    onKeyDown={layout === "scroller" ? (event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                            event.preventDefault();
                            scroll(event.key === "ArrowRight" ? 1 : -1);
                        }
                    } : undefined}
                    className={cn(
                        layout === "grid" ? "grid gap-5 sm:grid-cols-2 sm:gap-6" : "flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pt-1 pb-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]",
                    )}
                >
                    {isPending ? Array.from({ length: layout === "grid" ? limit : 5 }, (_, index) => (
                        <div key={index} aria-hidden="true" className={cn("overflow-hidden rounded-xl border border-[#e7e9e1] bg-white", layout === "scroller" && "w-[240px] shrink-0")}>
                            <div className={cn("animate-pulse bg-[#e9ecdf] motion-reduce:animate-none", layout === "grid" ? "aspect-[16/10]" : "aspect-[4/3]")} />
                            <div className="space-y-3 p-5"><div className="h-3 w-3/4 rounded bg-[#eef0e7]" /><div className="h-2 w-1/2 rounded bg-[#eef0e7]" /></div>
                        </div>
                    )) : data?.items.map((asset) => (
                        <div key={asset.id} className={layout === "scroller" ? "w-[240px] shrink-0 snap-start sm:w-[250px]" : "min-w-0"}>
                            <AssetCard asset={asset} variant={layout === "grid" ? "featured" : "compact"} />
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
