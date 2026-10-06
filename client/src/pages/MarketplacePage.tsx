import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBrowseAssets } from "@/hooks/useAsset";
import { useDebounce } from "@/hooks/useDebounce";
import AssetCard from "@/components/marketplace/AssetCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { AssetCategory, BrowseSort, ListingType } from "@/types/asset";

const CATEGORY_OPTIONS: { value: AssetCategory; label: string }[] = [
    { value: "THREE_D_MODEL", label: "3D models" },
    { value: "IMAGE", label: "Images" },
    { value: "VIDEO", label: "Videos" },
    { value: "SOUND_EFFECT", label: "Sound effects" },
    { value: "FONT", label: "Fonts" },
    { value: "ANIMATION", label: "Animations" },
];

const SORT_OPTIONS: { value: BrowseSort; label: string }[] = [
    { value: "newest", label: "Newest" },
    { value: "best_selling", label: "Best selling" },
    { value: "price_asc", label: "Price: Low to High" },
    { value: "price_desc", label: "Price: High to Low" },
];

const ALL = "ALL";
const PAGE_SIZE = 18;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]";

function FilterOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
    return (
        <label className="flex cursor-pointer items-center gap-3 py-1.5 text-sm text-[#73776e] hover:text-[#30392b]">
            <input type="checkbox" checked={checked} onChange={onChange} className="size-4 shrink-0 cursor-pointer accent-[#657152] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]" />
            <span className={checked ? "font-medium text-[#30392b]" : ""}>{label}</span>
        </label>
    );
}

export default function MarketplacePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const keyword = searchParams.get("keyword") ?? "";
    const categoryParam = searchParams.get("category");
    const category = CATEGORY_OPTIONS.some((option) => option.value === categoryParam)
        ? categoryParam as AssetCategory : ALL;
    const sortParam = searchParams.get("sort");
    const sort = SORT_OPTIONS.some((option) => option.value === sortParam)
        ? sortParam as BrowseSort : "newest";

    const setBrowseParam = (key: string, value: string) => {
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            if (!value || value === ALL) next.delete(key);
            else next.set(key, value);
            return next;
        }, { replace: true });
    };
    const [listingType, setListingType] = useState<ListingType | typeof ALL>(ALL);
    const [aiFilter, setAiFilter] = useState<"ALL" | "AI" | "HUMAN">(ALL);
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [page, setPage] = useState(1);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const debouncedKeyword = useDebounce(keyword, 300);
    const debouncedMin = useDebounce(minPrice, 300);
    const debouncedMax = useDebounce(maxPrice, 300);

    const filterKey = JSON.stringify([
        debouncedKeyword,
        category,
        listingType,
        aiFilter,
        debouncedMin,
        debouncedMax,
        sort,
    ]);
    const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
    if (filterKey !== prevFilterKey) {
        setPrevFilterKey(filterKey);
        setPage(1);
    }

    const params = useMemo(() => {
        const p: Record<string, unknown> = { sort, page, pageSize: PAGE_SIZE };
        if (debouncedKeyword.trim()) p.keyword = debouncedKeyword.trim();
        if (category !== ALL) p.category = category;
        if (listingType !== ALL) p.listingType = listingType;
        if (aiFilter === "AI") p.isAiGenerated = true;
        else if (aiFilter === "HUMAN") p.isAiGenerated = false;
        const min = parseFloat(debouncedMin);
        const max = parseFloat(debouncedMax);
        if (!isNaN(min) && min >= 0) p.minPrice = min;
        if (!isNaN(max) && max >= 0) p.maxPrice = max;
        return p;
    }, [debouncedKeyword, category, listingType, aiFilter, debouncedMin, debouncedMax, sort, page]);

    const { data, isLoading, error, refetch } = useBrowseAssets(params);

    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

    const clearFilters = () => {
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            next.delete("keyword");
            next.delete("category");
            return next;
        }, { replace: true });
        setListingType(ALL);
        setAiFilter(ALL);
        setMinPrice("");
        setMaxPrice("");
        setPage(1);
    };
    const activeFilters = [
        ...(keyword.trim() ? [{ key: "keyword", label: keyword.trim(), remove: () => setBrowseParam("keyword", "") }] : []),
        ...(category !== ALL ? [{ key: "category", label: CATEGORY_OPTIONS.find((option) => option.value === category)!.label, remove: () => setBrowseParam("category", ALL) }] : []),
        ...(listingType !== ALL ? [{ key: "listing", label: listingType === "TRADITIONAL" ? "Traditional" : "Blockchain", remove: () => setListingType(ALL) }] : []),
        ...(aiFilter !== ALL ? [{ key: "source", label: aiFilter === "AI" ? "AI-generated" : "Human-made", remove: () => setAiFilter(ALL) }] : []),
        ...(minPrice ? [{ key: "min", label: `Min price: ${minPrice}`, remove: () => setMinPrice("") }] : []),
        ...(maxPrice ? [{ key: "max", label: `Max price: ${maxPrice}`, remove: () => setMaxPrice("") }] : []),
    ];
    const pageNumbers = Array.from(new Set([1, page - 1, page, page + 1, totalPages]))
        .filter((number) => number >= 1 && number <= totalPages).sort((a, b) => a - b);

    return (
        <main className="min-h-[calc(100dvh-73px)] bg-[#f7f7f2] text-[#252823]">
            <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
                <aside aria-label="Marketplace filters" className="border-b border-[#e7e9e1] bg-[#fcfcfa]/60 lg:border-r lg:border-b-0">
                    <div className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:py-7">
                        <h2 className="hidden text-xs font-semibold tracking-[0.14em] text-[#555e49] lg:block">FILTERS</h2>
                        <button type="button" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} aria-controls="marketplace-filters" className={cn("flex items-center gap-2 rounded-sm text-sm font-medium lg:hidden", FOCUS)}>
                            <SlidersHorizontal className="size-4" aria-hidden="true" />Filters
                            {activeFilters.length > 0 && <span className="rounded-full bg-[#e3e8d8] px-2 py-0.5 text-xs text-[#555e49]">{activeFilters.length}</span>}
                        </button>
                        <button type="button" onClick={clearFilters} disabled={!activeFilters.length} className={cn("rounded-sm text-xs font-medium text-[#657152] hover:underline disabled:opacity-40", FOCUS)}>Clear all</button>
                    </div>
                    <div id="marketplace-filters" className={cn("space-y-8 px-5 pb-8 sm:px-8 lg:block lg:pt-4", !filtersOpen && "hidden")}>
                        <fieldset>
                            <legend className="mb-3 text-sm font-semibold">Category</legend>
                            {CATEGORY_OPTIONS.map((option) => <FilterOption key={option.value} label={option.label} checked={category === option.value} onChange={() => setBrowseParam("category", category === option.value ? ALL : option.value)} />)}
                        </fieldset>
                        <fieldset>
                            <legend className="mb-4 text-sm font-semibold">Price range</legend>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="minPrice" className="mb-2 text-xs text-[#73776e]">Minimum</Label>
                                    <Input id="minPrice" type="number" min="0" placeholder="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} className="h-10 border-[#dfe4d6] bg-white shadow-none focus-visible:ring-[#7a8568]/20" />
                                </div>
                                <div>
                                    <Label htmlFor="maxPrice" className="mb-2 text-xs text-[#73776e]">Maximum</Label>
                                    <Input id="maxPrice" type="number" min="0" placeholder="Any" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} className="h-10 border-[#dfe4d6] bg-white shadow-none focus-visible:ring-[#7a8568]/20" />
                                </div>
                            </div>
                        </fieldset>
                        <fieldset>
                            <legend className="mb-3 text-sm font-semibold">Listing type</legend>
                            <FilterOption label="Traditional" checked={listingType === "TRADITIONAL"} onChange={() => setListingType(listingType === "TRADITIONAL" ? ALL : "TRADITIONAL")} />
                            <FilterOption label="Blockchain" checked={listingType === "BLOCKCHAIN"} onChange={() => setListingType(listingType === "BLOCKCHAIN" ? ALL : "BLOCKCHAIN")} />
                        </fieldset>
                        <fieldset>
                            <legend className="mb-3 text-sm font-semibold">Creation source</legend>
                            <FilterOption label="AI-generated" checked={aiFilter === "AI"} onChange={() => setAiFilter(aiFilter === "AI" ? ALL : "AI")} />
                            <FilterOption label="Human-made" checked={aiFilter === "HUMAN"} onChange={() => setAiFilter(aiFilter === "HUMAN" ? ALL : "HUMAN")} />
                        </fieldset>
                        
                    </div>
                </aside>

                <div className="min-w-0">
                    <div aria-label="Active filters" className="flex min-h-[77px] flex-wrap items-center gap-2 border-b border-[#e7e9e1] px-5 py-4 sm:px-8 lg:px-10">
                        <span className="mr-2 text-[10px] font-semibold tracking-[0.12em] text-[#73776e]">ACTIVE FILTERS</span>
                        {activeFilters.length ? activeFilters.map((filter) => (
                            <button key={filter.key} type="button" onClick={filter.remove} aria-label={`Remove filter: ${filter.label}`} className={cn("inline-flex max-w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors motion-reduce:transition-none", filter.key === "keyword" ? "bg-[#657152] text-white hover:bg-[#555e49]" : "bg-[#e3e8d8] text-[#555e49] hover:bg-[#d8dfcc]", FOCUS)}>
                                <span className="truncate">{filter.label}</span><X className="size-3.5 shrink-0" aria-hidden="true" />
                            </button>
                        )) : <span className="text-xs text-[#85897f]">All creative assets</span>}
                        {activeFilters.length > 0 && <button type="button" onClick={clearFilters} className={cn("ml-2 rounded-sm border-l border-[#dfe4d6] pl-4 text-xs font-medium text-[#657152] hover:underline", FOCUS)}>Clear all</button>}
                    </div>

                    <section aria-label="Marketplace assets" className="px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
                        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-[#73776e]">
                            <Link to="/" className={cn("rounded-sm hover:text-[#30392b]", FOCUS)}>Home</Link>
                            <ChevronRight className="size-3" aria-hidden="true" />
                            <span aria-current="page">Marketplace</span>
                        </nav>
                        <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div role="search" aria-label="Search marketplace" className="flex w-full items-center gap-2 rounded-xl border border-[#dfe4d6] bg-white px-3 xl:max-w-[420px]">
                                <Search className="size-4 shrink-0 text-[#85897f]" aria-hidden="true" />
                                <Input type="search" placeholder="Search creative assets…" value={keyword} onChange={(event) => setBrowseParam("keyword", event.target.value)} aria-label="Search marketplace assets" className="h-11 min-w-0 border-0 bg-transparent px-1 shadow-none focus-visible:ring-[#7a8568]/20" />
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                                <span id="sort-label" className="text-[10px] font-semibold tracking-[0.12em] text-[#73776e]">SORT BY</span>
                                <Select value={sort} onValueChange={(value) => setBrowseParam("sort", value)}>
                                    <SelectTrigger aria-labelledby="sort-label" className="h-11 w-[190px] border-[#dfe4d6] bg-[#fcfcfa] px-4 text-xs text-[#555e49] focus-visible:ring-[#7a8568]/20"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-[#fcfcfa] text-[#252823]">{SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div aria-live="polite" aria-atomic="true" className="mb-4 text-xs text-[#85897f]">
                            {isLoading ? "Finding creative assets…" : error ? "Assets are currently unavailable" : data ? `${data.total.toLocaleString()} ${data.total === 1 ? "asset" : "assets"} to explore` : ""}
                        </div>
                        {isLoading && <div aria-hidden="true" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className="overflow-hidden rounded-xl border border-[#e7e9e1] bg-white">
                                <div className="aspect-[4/3] animate-pulse bg-[#e9ecdf] motion-reduce:animate-none" />
                                <div className="space-y-3 p-4"><div className="h-3 w-3/4 animate-pulse rounded bg-[#e9ecdf] motion-reduce:animate-none" /><div className="h-3 w-1/2 animate-pulse rounded bg-[#e9ecdf] motion-reduce:animate-none" /></div>
                            </div>
                        ))}</div>}
                        {error && <div role="alert" className="rounded-xl border border-[#dfe4d6] bg-[#fcfcfa] px-6 py-12 text-center">
                            <h2 className="text-lg font-medium">We couldn’t load the assets.</h2><p className="mt-2 text-sm text-[#73776e]">Please try again in a moment.</p>
                            <Button onClick={() => void refetch()} className="mt-5 bg-[#30392b] text-white hover:bg-[#444f3a]">Try again</Button>
                        </div>}
                        {data && !error && data.items.length === 0 && <div className="rounded-xl border border-dashed border-[#c5cfb5] px-6 py-16 text-center">
                            <Search className="mx-auto mb-4 size-7 text-[#7a8568]" aria-hidden="true" /><h2 className="text-lg font-medium">No assets found</h2>
                            <p className="mt-2 text-sm text-[#73776e]">Try a different search or adjust your filters.</p>
                            {activeFilters.length > 0 && <Button onClick={clearFilters} className="mt-5 bg-[#30392b] text-white hover:bg-[#444f3a]">Clear filters</Button>}
                        </div>}
                        {data && !error && data.items.length > 0 && <>
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{data.items.map((asset) => <AssetCard key={asset.id} asset={asset} variant="compact" />)}</div>
                            <div className="mt-12 border-t border-[#e7e9e1] pt-8">
                                {totalPages > 1 && <nav aria-label="Marketplace pagination" className="flex items-center justify-center gap-2">
                                    <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)} className={cn("flex size-10 items-center justify-center rounded-lg bg-[#eceee7] text-[#555e49] hover:bg-[#e3e8d8] disabled:cursor-not-allowed disabled:opacity-40", FOCUS)}><ChevronLeft className="size-4" aria-hidden="true" /></button>
                                    {pageNumbers.map((number, index) => <span key={number} className="flex items-center gap-2">
                                        {index > 0 && number - pageNumbers[index - 1] > 1 && <span className="px-1 text-[#85897f]">…</span>}
                                        <button type="button" aria-label={`Page ${number}`} aria-current={number === page ? "page" : undefined} onClick={() => setPage(number)} className={cn("size-10 rounded-lg text-sm font-medium", number === page ? "bg-[#657152] text-white shadow-sm" : "border border-[#e7e9e1] bg-[#fcfcfa] text-[#555e49] hover:bg-[#e3e8d8]", FOCUS)}>{number}</button>
                                    </span>)}
                                    <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={cn("flex size-10 items-center justify-center rounded-lg bg-[#eceee7] text-[#555e49] hover:bg-[#e3e8d8] disabled:cursor-not-allowed disabled:opacity-40", FOCUS)}><ChevronRight className="size-4" aria-hidden="true" /></button>
                                </nav>}
                                <p className="mt-5 text-center text-xs text-[#85897f]">Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total.toLocaleString()} results</p>
                            </div>
                        </>}
                    </section>
                </div>
            </div>
        </main>
    );
}
