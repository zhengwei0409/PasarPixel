import { useBrowseAssets } from "@/hooks/useAsset";
import AssetCard from "@/components/marketplace/AssetCard";

export default function MarketplacePage() {
    const { data, isLoading, error } = useBrowseAssets({});

    return (
        <div className="mx-auto max-w-6xl px-6 py-8">
            <h1 className="mb-6 text-2xl font-semibold">Marketplace</h1>

            {isLoading && <p className="text-muted-foreground">Loading...</p>}
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
                </>
            )}
        </div>
    );
}
