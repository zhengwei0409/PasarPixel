import { useState, useMemo } from "react";
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
    { value: "THREE_D_MODEL", label: "3D Model" },
    { value: "IMAGE", label: "Image" },
    { value: "VIDEO", label: "Video" },
    { value: "SOUND_EFFECT", label: "Sound Effect" },
    { value: "FONT", label: "Font" },
    { value: "ANIMATION", label: "Animation" },
];

const SORT_OPTIONS: { value: BrowseSort; label: string }[] = [
    { value: "newest", label: "Newest" },
    { value: "price_asc", label: "Price: Low to High" },
    { value: "price_desc", label: "Price: High to Low" },
];

const ALL = "ALL";
const PAGE_SIZE = 20;

export default function MarketplacePage() {
    const [keyword, setKeyword] = useState("");
    const [category, setCategory] = useState<AssetCategory | typeof ALL>(ALL);
    const [listingType, setListingType] = useState<ListingType | typeof ALL>(ALL);
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [sort, setSort] = useState<BrowseSort>("newest");
    const [page, setPage] = useState(1);

    const debouncedKeyword = useDebounce(keyword, 300);
    const debouncedMin = useDebounce(minPrice, 300);
    const debouncedMax = useDebounce(maxPrice, 300);

    const filterKey = JSON.stringify([
        debouncedKeyword,
        category,
        listingType,
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
        const min = parseFloat(debouncedMin);
        const max = parseFloat(debouncedMax);
        if (!isNaN(min) && min >= 0) p.minPrice = min;
        if (!isNaN(max) && max >= 0) p.maxPrice = max;
        return p;
    }, [debouncedKeyword, category, listingType, debouncedMin, debouncedMax, sort, page]);

    const { data, isLoading, error } = useBrowseAssets(params);

    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

    return (
        <div className="mx-auto max-w-6xl px-6 py-8">
            <h1 className="mb-6 text-2xl font-semibold">Marketplace</h1>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_auto_auto_auto]">
                <Input
                    placeholder="Search by keyword..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                />

                <Select value={category} onValueChange={(v) => setCategory(v as AssetCategory | typeof ALL)}>
                    <SelectTrigger className="md:w-44">
                        <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>All Categories</SelectItem>
                        {CATEGORY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={listingType} onValueChange={(v) => setListingType(v as ListingType | typeof ALL)}>
                    <SelectTrigger className="md:w-40">
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>All Types</SelectItem>
                        <SelectItem value="TRADITIONAL">Traditional</SelectItem>
                        <SelectItem value="BLOCKCHAIN">Blockchain</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={sort} onValueChange={(v) => setSort(v as BrowseSort)}>
                    <SelectTrigger className="md:w-48">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {SORT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="mb-6 flex flex-wrap items-end gap-3">
                <div>
                    <Label htmlFor="minPrice" className="text-xs">Min price</Label>
                    <Input
                        id="minPrice"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        className="w-28"
                    />
                </div>
                <div>
                    <Label htmlFor="maxPrice" className="text-xs">Max price</Label>
                    <Input
                        id="maxPrice"
                        type="number"
                        min="0"
                        placeholder="Any"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        className="w-28"
                    />
                </div>
            </div>

            {isLoading && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="overflow-hidden rounded-lg border bg-card">
                            <div className="aspect-square w-full animate-pulse bg-muted" />
                            <div className="space-y-2 p-3">
                                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                                <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {error && <p className="text-destructive">Failed to load assets.</p>}

            {data && data.items.length === 0 && (
                <p className="text-muted-foreground">No assets found.</p>
            )}

            {data && data.items.length > 0 && (
                <>
                    <p className="mb-4 text-sm text-muted-foreground">
                        {data.total} {data.total === 1 ? "asset" : "assets"}
                    </p>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        {data.items.map((asset) => (
                            <AssetCard key={asset.id} asset={asset} />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="mt-8 flex items-center justify-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                            >
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {page} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
