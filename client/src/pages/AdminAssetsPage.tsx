import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Box, ChevronLeft, ChevronRight, Film, ImageIcon, Loader2, Music2, Package, Search, Sparkles, Type } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useDebounce } from "../hooks/useDebounce";
import { getAdminAssets } from "../services/assetService";
import type { AssetCategory, AssetStatus } from "../types/asset";

const STATUS_LABELS: Record<AssetStatus, string> = {
    DRAFT: "Draft", PENDING_REVIEW: "Pending review", PUBLISHED: "Published", REJECTED: "Rejected", TAKEN_DOWN: "Taken down",
};
const CATEGORY_LABELS: Record<AssetCategory, string> = {
    THREE_D_MODEL: "3D model", IMAGE: "Image", VIDEO: "Video", SOUND_EFFECT: "Audio", FONT: "Font", ANIMATION: "Animation",
};
const CATEGORY_ICONS = { THREE_D_MODEL: Box, IMAGE: ImageIcon, VIDEO: Film, SOUND_EFFECT: Music2, FONT: Type, ANIMATION: Sparkles };
const STATUS_STYLES: Record<AssetStatus, string> = {
    DRAFT: "bg-secondary text-secondary-foreground", PENDING_REVIEW: "bg-secondary text-secondary-foreground", PUBLISHED: "bg-accent text-[#425137]", REJECTED: "bg-red-50 text-red-700", TAKEN_DOWN: "bg-red-50 text-red-700",
};
const dateLabel = (date: string) => new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const listingLabel = (type: string) => type === "BLOCKCHAIN" ? "Blockchain" : "Traditional";

export default function AdminAssetsPage() {
    const [params, setParams] = useSearchParams();
    const search = params.get("search") ?? "";
    const debouncedSearch = useDebounce(search.trim(), 300);
    const statusParam = params.get("status");
    const status = statusParam && Object.hasOwn(STATUS_LABELS, statusParam) ? statusParam as AssetStatus : undefined;
    const requestedPage = Number(params.get("page") ?? 1);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ["admin-assets", { page, status, search: debouncedSearch }],
        queryFn: () => getAdminAssets({ page, status, search: debouncedSearch || undefined }),
    });
    const pageSize = data?.pageSize ?? 20;
    const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
    const hasFilters = Boolean(search || status);
    const outOfRange = Boolean(data && page > pageCount);
    const start = (page - 1) * pageSize;

    function updateFilter(key: string, value: string) {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value); else next.delete(key);
        if (key !== "page") next.delete("page");
        setParams(next, { replace: key === "search" });
    }

    function clearFilters() {
        const next = new URLSearchParams(params);
        next.delete("search"); next.delete("status"); next.delete("page");
        setParams(next);
    }

    return (
        <main className="admin-dashboard-theme min-h-[calc(100dvh-72px)] bg-background px-4 py-8 text-foreground sm:px-8 sm:py-10">
            <div className="mx-auto max-w-[1200px] space-y-6">
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground"><Link to="/dashboard" className="inline-flex items-center gap-2 rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none"><ArrowLeft className="size-3.5" aria-hidden="true" />Dashboard</Link><span aria-hidden="true" className="px-1 text-border">/</span><span aria-current="page" className="text-foreground">All assets</span></nav>
                <header className="flex flex-wrap items-center justify-between gap-4 pb-2"><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">All assets</h1><Button asChild variant="outline" className="h-11 gap-2 bg-card px-4 motion-reduce:transition-none"><Link to="/admin/assets/pending">Pending assets<ArrowUpRight className="size-4" aria-hidden="true" /></Link></Button></header>
                <section aria-labelledby="asset-list-heading" className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                        <h2 id="asset-list-heading" className="flex h-11 items-center gap-2 px-1 text-sm font-medium">All assets<span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs tabular-nums text-secondary-foreground">{!error ? data?.total.toLocaleString() ?? "—" : "—"}</span></h2>
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
                            <div className="relative min-w-0 sm:w-64"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input type="search" aria-label="Search assets by title or seller" placeholder="Search assets…" value={search} maxLength={200} onChange={(event) => updateFilter("search", event.target.value)} className="h-11 bg-background/60 pl-9 text-sm" /></div>
                            <Select value={status ?? "ALL"} onValueChange={(value) => updateFilter("status", value === "ALL" ? "" : value)}><SelectTrigger aria-label="Filter assets by status" className="h-11 w-full bg-background/60 sm:w-40 data-[size=default]:h-11"><SelectValue /></SelectTrigger><SelectContent className="admin-dashboard-theme"><SelectItem value="ALL">All statuses</SelectItem>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                        </div>
                    </div>
                    <div aria-busy={isLoading || isFetching || search.trim() !== debouncedSearch}>
                        {isLoading ? <div role="status" className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading assets…</div>
                            : error || !data ? <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center"><p className="text-sm">Unable to load assets.</p><Button variant="outline" className="h-11" disabled={isFetching} onClick={() => void refetch()}>Try again</Button></div>
                            : data.items.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"><Package className="mb-4 size-8 text-[#7a8568]" strokeWidth={1.5} aria-hidden="true" /><h2 className="text-base font-medium">{outOfRange ? "No assets on this page" : hasFilters ? "No matching assets" : "No assets yet"}</h2>{outOfRange ? <Button variant="outline" className="mt-4 h-11" onClick={() => updateFilter("page", "")}>Go to first page</Button> : hasFilters && <Button variant="outline" className="mt-4 h-11" onClick={clearFilters}>Clear filters</Button>}</div>
                            : <table className="w-full table-fixed text-left text-sm"><caption className="sr-only">Marketplace assets</caption><thead className="border-b border-border bg-background/50 text-xs text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium sm:px-6">Asset &amp; seller</th><th scope="col" className="hidden w-28 px-4 py-3 font-medium lg:table-cell">Category</th><th scope="col" className="hidden w-28 px-4 py-3 font-medium xl:table-cell">Listing type</th><th scope="col" className="hidden w-36 px-4 py-3 font-medium sm:table-cell">Status</th><th scope="col" className="hidden w-36 px-4 py-3 font-medium md:table-cell">Updated</th><th scope="col" className="w-24 px-4 py-3 text-right font-medium sm:w-32 sm:px-6"><span className="sr-only">Actions</span></th></tr></thead>
                                <tbody className="divide-y divide-border">{data.items.map((asset) => {
                                    const CategoryIcon = CATEGORY_ICONS[asset.category];
                                    const detailUrl = `/admin/assets/${asset.id}/review?from=all`;
                                    const badge = <span className={`inline-flex max-w-full rounded-md px-2 py-1 text-xs font-medium ${STATUS_STYLES[asset.status]}`}>{STATUS_LABELS[asset.status]}</span>;
                                    return <tr key={asset.id} className="transition-colors hover:bg-background/70 motion-reduce:transition-none"><th scope="row" className="px-4 py-5 font-normal sm:px-6"><div className="flex min-w-0 items-start gap-3"><span className="hidden size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-[#657152] sm:flex" aria-hidden="true"><CategoryIcon className="size-5" /></span><div className="min-w-0"><Link to={detailUrl} className="block break-words rounded-sm font-semibold leading-5 tracking-tight hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{asset.title}</Link><p className="mt-1.5 break-words text-xs text-muted-foreground">{asset.seller.name || "Unnamed seller"}<span className="mx-1.5" aria-hidden="true">·</span>#{asset.id}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground xl:hidden"><span className="lg:hidden">{CATEGORY_LABELS[asset.category]}</span><span>{listingLabel(asset.listingType)}</span></div><div className="mt-2 sm:hidden">{badge}</div><time dateTime={asset.updatedAt} className="mt-2 block text-xs text-muted-foreground md:hidden">Updated {dateLabel(asset.updatedAt)}</time></div></div></th><td className="hidden px-4 py-5 text-xs lg:table-cell">{CATEGORY_LABELS[asset.category]}</td><td className="hidden px-4 py-5 text-xs text-muted-foreground xl:table-cell">{listingLabel(asset.listingType)}</td><td className="hidden px-4 py-5 sm:table-cell">{badge}</td><td className="hidden px-4 py-5 text-xs text-muted-foreground md:table-cell"><time dateTime={asset.updatedAt}>{dateLabel(asset.updatedAt)}</time></td><td className="px-4 py-5 text-right sm:px-6"><Button asChild variant="outline" className="h-11 bg-card px-3 text-xs motion-reduce:transition-none"><Link to={detailUrl} aria-label={`View details for ${asset.title}`}>View<span className="hidden sm:inline"> details</span></Link></Button></td></tr>;
                                })}</tbody>
                            </table>}
                    </div>
                    {!isLoading && !error && data && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-6"><p role="status" className="text-xs text-muted-foreground">{data.items.length ? `${start + 1}–${start + data.items.length} of ${data.total.toLocaleString()}` : data.total.toLocaleString()} {data.total === 1 ? "asset" : "assets"}</p>{pageCount > 1 && !outOfRange && <nav aria-label="Asset pages" className="flex items-center gap-2"><span className="mr-2 text-xs text-muted-foreground">Page {page} of {pageCount}</span><Button variant="outline" size="icon" className="size-11" aria-label="Previous page" disabled={page <= 1 || isFetching} onClick={() => updateFilter("page", String(page - 1))}><ChevronLeft aria-hidden="true" /></Button><Button variant="outline" size="icon" className="size-11" aria-label="Next page" disabled={page >= pageCount || isFetching} onClick={() => updateFilter("page", String(page + 1))}><ChevronRight aria-hidden="true" /></Button></nav>}</footer>}
                </section>
            </div>
        </main>
    );
}
