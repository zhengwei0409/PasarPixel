import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Package, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { getAdminAssets } from "../services/assetService";
import { getErrorMessage } from "../lib/errors";
import type { AssetCategory, AssetStatus } from "../types/asset";

const statusLabels: Record<AssetStatus, string> = {
    DRAFT: "Draft", PENDING_REVIEW: "Pending review", PUBLISHED: "Published", REJECTED: "Rejected", TAKEN_DOWN: "Taken down",
};
const categoryLabels: Record<AssetCategory, string> = {
    THREE_D_MODEL: "3D model", IMAGE: "Image", VIDEO: "Video", SOUND_EFFECT: "Audio", FONT: "Font", ANIMATION: "Animation",
};
const statusStyles: Record<AssetStatus, string> = {
    DRAFT: "bg-secondary text-secondary-foreground", PENDING_REVIEW: "bg-amber-50 text-amber-800", PUBLISHED: "bg-accent text-[#425137]", REJECTED: "bg-red-50 text-red-700", TAKEN_DOWN: "bg-red-50 text-red-700",
};

export default function AdminAssetsPage() {
    const [params, setParams] = useSearchParams();
    const search = params.get("search") ?? "";
    const [searchInput, setSearchInput] = useState(search);
    const statusParam = params.get("status");
    const status = statusParam && Object.hasOwn(statusLabels, statusParam) ? statusParam as AssetStatus : undefined;
    const requestedPage = Number(params.get("page") ?? 1);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ["admin-assets", { page, status, search }],
        queryFn: () => getAdminAssets({ page, status, search: search || undefined }),
    });
    const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20)));

    function updateFilter(key: string, value: string) {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value); else next.delete(key);
        if (key !== "page") next.delete("page");
        setParams(next);
    }

    return (
        <div className="admin-dashboard-theme min-h-screen bg-background px-4 py-8 text-foreground sm:px-8 sm:py-10">
            <div className="mx-auto max-w-[1200px] space-y-6">
                <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Back to dashboard</Link>
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div><p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Marketplace inventory</p><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">All assets</h1><p className="mt-2 text-xs leading-5 text-muted-foreground">Browse drafts, pending reviews, published, rejected, and taken-down assets.</p></div>
                    <Button asChild variant="outline"><Link to="/admin/assets/pending">Open review queue<ArrowRight className="size-4" /></Link></Button>
                </header>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <form className="flex w-full gap-2 sm:max-w-md" onSubmit={(event) => { event.preventDefault(); updateFilter("search", searchInput.trim()); }}>
                        <Input aria-label="Search assets by title or seller" placeholder="Search by title or seller…" value={searchInput} maxLength={200} onChange={(event) => setSearchInput(event.target.value)} className="h-10 bg-card" />
                        <Button type="submit" variant="outline" className="h-10" aria-label="Search assets"><Search className="size-4" /></Button>
                    </form>
                    <div className="flex items-center gap-3"><span id="admin-asset-status-label" className="text-xs text-muted-foreground">Status</span><Select value={status ?? "ALL"} onValueChange={(value) => updateFilter("status", value === "ALL" ? "" : value)}><SelectTrigger aria-labelledby="admin-asset-status-label" className="w-44 bg-card data-[size=default]:h-10"><SelectValue /></SelectTrigger><SelectContent position="popper" align="end" className="admin-dashboard-theme border border-border bg-popover p-1 text-popover-foreground"><SelectItem value="ALL">All statuses</SelectItem>{Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <Card className="overflow-hidden rounded-xl py-0 ring-border"><CardContent className="px-0">
                    {isLoading ? <p role="status" className="p-6 text-sm text-muted-foreground">Loading assets…</p> : error ? <div role="alert" className="space-y-3 p-6"><p className="text-sm text-red-700">{getErrorMessage(error)}</p><Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>Try again</Button></div> : data && data.items.length > 0 ? (
                        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-secondary/60 text-muted-foreground"><tr>{["Asset", "Seller", "Category", "Listing type", "Status", "Updated", ""].map((label) => <th key={label} className="whitespace-nowrap px-5 py-4 font-medium">{label}</th>)}</tr></thead><tbody>{data.items.map((asset) => <tr key={asset.id} className="border-t border-border/60 hover:bg-background/60">
                            <td className="min-w-48 px-5 py-4"><Link to={`/admin/assets/${asset.id}/review?from=all`} className="font-medium hover:underline">{asset.title}</Link><p className="mt-1 text-[10px] text-muted-foreground">#{asset.id}</p></td>
                            <td className="px-5 py-4">{asset.seller.name}</td><td className="whitespace-nowrap px-5 py-4">{categoryLabels[asset.category]}</td><td className="px-5 py-4">{asset.listingType === "BLOCKCHAIN" ? "Blockchain" : "Traditional"}</td>
                            <td className="px-5 py-4"><span className={`whitespace-nowrap rounded px-2 py-1 text-[10px] font-medium ${statusStyles[asset.status]}`}>{statusLabels[asset.status]}</span></td><td className="whitespace-nowrap px-5 py-4 text-muted-foreground"><time dateTime={asset.updatedAt}>{new Date(asset.updatedAt).toLocaleDateString()}</time></td>
                            <td className="px-5 py-4"><Link to={`/admin/assets/${asset.id}/review?from=all`} className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-[#555e49] hover:underline" aria-label={`View ${asset.title}`}>View details<ArrowRight className="size-3.5" /></Link></td>
                        </tr>)}</tbody></table></div>
                    ) : <div className="flex flex-col items-center px-6 py-14 text-center"><Package className="mb-3 size-8 text-[#7a8568]" /><p className="text-sm font-medium">No assets found</p><p className="mt-2 text-xs text-muted-foreground">{search || status ? "Try another search or status filter." : "Assets will appear here when sellers create listings."}</p></div>}
                </CardContent></Card>
                {data && <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground"><p>{data.total.toLocaleString()} assets · Page {page} of {pageCount}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => updateFilter("page", String(page - 1))}>Previous</Button><Button variant="outline" size="sm" disabled={page >= pageCount || isFetching} onClick={() => updateFilter("page", String(page + 1))}>Next</Button></div></div>}
            </div>
        </div>
    );
}
