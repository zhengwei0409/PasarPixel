import { useParams, Link } from "react-router-dom";
import { usePublicAsset } from "@/hooks/useAsset";
import { Button } from "@/components/ui/button";
import type { AssetCategory } from "@/types/asset";

const CATEGORY_LABELS: Record<AssetCategory, string> = {
    THREE_D_MODEL: "3D Model",
    IMAGE: "Image",
    VIDEO: "Video",
    SOUND_EFFECT: "Sound",
    FONT: "Font",
    ANIMATION: "Animation",
};

function formatPrice(price: string | null): string {
    if (price === null) return "Free";
    return `$${Number(price).toFixed(2)}`;
}

export default function AssetDetailPage() {
    const { id } = useParams<{ id: string }>();
    const assetId = id ? parseInt(id, 10) : NaN;
    const validId = !isNaN(assetId);

    const { data: asset, isLoading, error } = usePublicAsset(validId ? assetId : null);

    if (!validId) {
        return (
            <div className="mx-auto max-w-6xl px-6 py-8">
                <p className="text-destructive">Invalid asset id.</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="mx-auto max-w-6xl px-6 py-8">
                <div className="grid gap-8 md:grid-cols-2">
                    <div className="aspect-square w-full animate-pulse rounded-lg bg-muted" />
                    <div className="space-y-4">
                        <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                        <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
                        <div className="h-24 w-full animate-pulse rounded bg-muted" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !asset) {
        return (
            <div className="mx-auto max-w-6xl px-6 py-8 text-center">
                <h1 className="mb-2 text-2xl font-semibold">Asset not found</h1>
                <p className="mb-6 text-muted-foreground">
                    This asset may have been removed or is no longer available.
                </p>
                <Link to="/marketplace">
                    <Button variant="outline">Back to marketplace</Button>
                </Link>
            </div>
        );
    }

    const thumbnail = asset.files.find((f) => f.fileType.startsWith("image/"));

    return (
        <div className="mx-auto max-w-6xl px-6 py-8">
            <div className="grid gap-8 md:grid-cols-2">
                <div className="aspect-square w-full overflow-hidden rounded-lg border bg-muted">
                    {thumbnail ? (
                        <img
                            src={thumbnail.fileUrl}
                            alt={asset.title}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                            No preview
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                        <h1 className="text-2xl font-semibold">{asset.title}</h1>
                        <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs uppercase text-muted-foreground">
                            {CATEGORY_LABELS[asset.category]}
                        </span>
                    </div>

                    <p className="text-sm text-muted-foreground">by {asset.seller.name}</p>

                    <p className="text-2xl font-semibold">{formatPrice(asset.pricePersonal)}</p>

                    {asset.description && (
                        <div>
                            <h2 className="mb-2 text-sm font-medium">Description</h2>
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                {asset.description}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
