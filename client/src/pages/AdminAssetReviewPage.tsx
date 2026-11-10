import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Box, ChevronLeft, ChevronRight, ClipboardCheck, Film, ImageIcon, Loader2, Music2, Search, Sparkles, Type } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { usePendingReviewAssets } from "../hooks/useAsset";
import type { AssetCategory, ListingType } from "../types/asset";

type ListingFilter = "ALL" | ListingType;
const PAGE_SIZE = 10;
const CATEGORY_LABELS: Record<AssetCategory, string> = {
    THREE_D_MODEL: "3D model", IMAGE: "Image", VIDEO: "Video", SOUND_EFFECT: "Audio", FONT: "Font", ANIMATION: "Animation",
};
const CATEGORY_ICONS = { THREE_D_MODEL: Box, IMAGE: ImageIcon, VIDEO: Film, SOUND_EFFECT: Music2, FONT: Type, ANIMATION: Sparkles };
const listingLabel = (type: ListingType) => type === "BLOCKCHAIN" ? "Blockchain" : "Traditional";
const fileLabel = (count: number) => `${count} ${count === 1 ? "file" : "files"}`;
const dateLabel = (date: string) => new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function AdminAssetReviewPage() {
    const assets = usePendingReviewAssets();
    const [listingType, setListingType] = useState<ListingFilter>("ALL");
    const [category, setCategory] = useState<AssetCategory | "ALL">("ALL");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("oldest");
    const [page, setPage] = useState(1);
    const query = search.trim().toLowerCase();
    const filtered = (assets.data ?? []).filter((asset) => (listingType === "ALL" || asset.listingType === listingType)
        && (category === "ALL" || asset.category === category)
        && `${asset.id} ${asset.title} ${asset.seller.name ?? ""} ${asset.seller.email ?? ""} ${asset.description ?? ""}`.toLowerCase().includes(query))
        .sort((a, b) => sort === "name" ? a.title.localeCompare(b.title) || a.id - b.id
            : (Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id) * (sort === "newest" ? -1 : 1));
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const visible = filtered.slice(start, start + PAGE_SIZE);
    const counts = {
        ALL: assets.data?.length,
        TRADITIONAL: assets.data?.filter((asset) => asset.listingType === "TRADITIONAL").length,
        BLOCKCHAIN: assets.data?.filter((asset) => asset.listingType === "BLOCKCHAIN").length,
    };
    const hasFilters = Boolean(query) || category !== "ALL" || listingType !== "ALL";

    function clearFilters() {
        setSearch(""); setCategory("ALL"); setListingType("ALL"); setPage(1);
    }

    return (
        <main className="admin-dashboard-theme min-h-[calc(100dvh-72px)] bg-background px-4 py-8 text-foreground sm:px-8 sm:py-10">
            <div className="mx-auto max-w-[1200px] space-y-6">
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground"><Link to="/dashboard" className="inline-flex items-center gap-2 rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none"><ArrowLeft className="size-3.5" aria-hidden="true" />Dashboard</Link><span aria-hidden="true" className="px-1 text-border">/</span><span aria-current="page" className="text-foreground">Pending assets</span></nav>
                <header className="flex flex-wrap items-center justify-between gap-4 pb-2"><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Pending assets</h1><Button asChild variant="outline" className="h-11 gap-2 bg-card px-4 motion-reduce:transition-none"><Link to="/admin/assets">All assets<ArrowUpRight className="size-4" aria-hidden="true" /></Link></Button></header>
                <Tabs value={listingType} onValueChange={(value) => { setListingType(value as ListingFilter); setPage(1); }} className="gap-0 overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
                        <TabsList aria-label="Listing type" variant="line" className="h-11 gap-1 p-0">{([{ value: "ALL", label: "All" }, { value: "TRADITIONAL", label: "Traditional" }, { value: "BLOCKCHAIN", label: "Blockchain" }] as const).map(({ value, label }) => <TabsTrigger key={value} value={value} className="h-11 gap-2 px-2 after:bottom-0 after:bg-primary motion-reduce:transition-none motion-reduce:after:transition-none sm:px-3 xl:after:bottom-[-17px]">{label}<span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs tabular-nums text-secondary-foreground">{counts[value]?.toLocaleString() ?? "—"}</span></TabsTrigger>)}</TabsList>
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row"><div className="relative min-w-0 sm:w-56"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input type="search" aria-label="Search pending assets" placeholder="Search assets…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="h-11 bg-background/60 pl-9 text-sm" /></div><div className="grid grid-cols-2 gap-3 sm:flex">
                            <Select value={category} onValueChange={(value) => { setCategory(value as AssetCategory | "ALL"); setPage(1); }}><SelectTrigger aria-label="Filter by category" className="h-11 w-full bg-background/60 sm:w-36 data-[size=default]:h-11"><SelectValue /></SelectTrigger><SelectContent className="admin-dashboard-theme"><SelectItem value="ALL">All categories</SelectItem>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                            <Select value={sort} onValueChange={(value) => { setSort(value); setPage(1); }}><SelectTrigger aria-label="Sort pending assets" className="h-11 w-full bg-background/60 sm:w-36 data-[size=default]:h-11"><SelectValue /></SelectTrigger><SelectContent className="admin-dashboard-theme"><SelectItem value="oldest">Oldest first</SelectItem><SelectItem value="newest">Newest first</SelectItem><SelectItem value="name">Title A–Z</SelectItem></SelectContent></Select>
                        </div></div>
                    </div>
                    <TabsContent value={listingType} className="m-0" aria-busy={assets.isLoading}>
                        {assets.isLoading ? <div role="status" className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading pending assets…</div>
                            : assets.error || !assets.data ? <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center"><p className="text-sm">Unable to load pending assets.</p><Button variant="outline" className="h-10" disabled={assets.isFetching} onClick={() => void assets.refetch()}>Try again</Button></div>
                            : visible.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"><ClipboardCheck className="mb-4 size-8 text-[#7a8568]" strokeWidth={1.5} aria-hidden="true" /><h2 className="text-base font-medium">{assets.data.length === 0 ? "No assets awaiting review" : "No matching assets"}</h2>{hasFilters && <Button variant="outline" className="mt-4 h-10" onClick={clearFilters}>Clear filters</Button>}</div>
                            : <table className="w-full table-fixed text-left text-sm"><caption className="sr-only">Assets awaiting review</caption><thead className="border-b border-border bg-background/50 text-xs text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium sm:px-6">Asset &amp; seller</th><th scope="col" className="hidden w-32 px-4 py-3 font-medium sm:table-cell">Category</th><th scope="col" className="hidden w-32 px-4 py-3 font-medium lg:table-cell">Listing type</th><th scope="col" className="hidden w-20 px-4 py-3 font-medium lg:table-cell">Files</th><th scope="col" className="hidden w-36 px-4 py-3 font-medium md:table-cell">Created</th><th scope="col" className="w-24 px-4 py-3 text-right font-medium sm:w-28 sm:px-6"><span className="sr-only">Actions</span></th></tr></thead>
                                <tbody className="divide-y divide-border">{visible.map((asset) => {
                                    const CategoryIcon = CATEGORY_ICONS[asset.category];
                                    return <tr key={asset.id} className="transition-colors hover:bg-background/70 motion-reduce:transition-none"><th scope="row" className="px-4 py-5 font-normal sm:px-6"><div className="flex min-w-0 items-center gap-3"><span className="hidden size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-[#657152] sm:flex" aria-hidden="true"><CategoryIcon className="size-5" /></span><div className="min-w-0"><Link to={`/admin/assets/${asset.id}/review`} className="block break-words rounded-sm font-semibold leading-5 tracking-tight hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{asset.title}</Link><p className="mt-1.5 break-words text-xs text-muted-foreground">{asset.seller.name || "Unnamed seller"}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground lg:hidden"><span className="sm:hidden">{CATEGORY_LABELS[asset.category]}</span><span>{listingLabel(asset.listingType)}</span><span>{fileLabel(asset._count.files)}</span></div><time dateTime={asset.createdAt} className="mt-2 block text-xs text-muted-foreground md:hidden">{dateLabel(asset.createdAt)}</time>{asset.isAiGenerated && <span className="mt-2 inline-block rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">AI-generated</span>}</div></div></th><td className="hidden px-4 py-5 text-xs sm:table-cell">{CATEGORY_LABELS[asset.category]}</td><td className="hidden px-4 py-5 text-xs text-muted-foreground lg:table-cell">{listingLabel(asset.listingType)}</td><td className="hidden px-4 py-5 text-xs tabular-nums text-muted-foreground lg:table-cell">{asset._count.files}</td><td className="hidden px-4 py-5 text-xs text-muted-foreground md:table-cell"><time dateTime={asset.createdAt}>{dateLabel(asset.createdAt)}</time></td><td className="px-4 py-5 text-right sm:px-6"><Button asChild variant="outline" className="h-10 bg-card px-3 text-xs motion-reduce:transition-none"><Link to={`/admin/assets/${asset.id}/review`} aria-label={`Review ${asset.title}`}>Review</Link></Button></td></tr>;
                                })}</tbody>
                            </table>}
                        {!assets.isLoading && !assets.error && assets.data && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-6"><p role="status" className="text-xs text-muted-foreground">{filtered.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString()}` : "0"} {filtered.length === 1 ? "asset" : "assets"}</p>{totalPages > 1 && <nav aria-label="Pending asset pages" className="flex items-center gap-2"><span className="mr-2 text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span><Button variant="outline" size="icon" className="size-10" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden="true" /></Button><Button variant="outline" size="icon" className="size-10" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight aria-hidden="true" /></Button></nav>}</footer>}
                    </TabsContent>
                </Tabs>
            </div>
        </main>
    );
}
