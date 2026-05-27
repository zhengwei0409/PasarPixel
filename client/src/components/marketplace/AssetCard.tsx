import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AiBadge } from "@/components/marketplace/AiBadge";
import type { BrowseAssetItem } from "@/types/asset";
import { formatPrice, formatSol } from "@/lib/price";

const CATEGORY_LABELS: Record<BrowseAssetItem["category"], string> = {
    THREE_D_MODEL: "3D Model",
    IMAGE: "Image",
    VIDEO: "Video",
    SOUND_EFFECT: "Sound",
    FONT: "Font",
    ANIMATION: "Animation",
};

function startingPriceLabel(asset: BrowseAssetItem): string {
    if (asset.listingType === "BLOCKCHAIN") {
        return formatSol(asset.priceSol);
    }
    const prices = [asset.pricePersonal, asset.priceCommercial]
        .map((p) => (p === null ? null : parseFloat(p)))
        .filter((n): n is number => n !== null && !isNaN(n));
    if (prices.length === 0) return "—";
    const min = Math.min(...prices);
    if (min === 0) return "Free";
    return `from ${formatPrice(min, asset.currency)}`;
}

export default function AssetCard({ asset }: { asset: BrowseAssetItem }) {
    const thumbnail = asset.files.find((f) => f.fileType.startsWith("image/"));

    return (
        <Link
            to={`/assets/${asset.id}`}
            className="group block overflow-hidden rounded-lg border bg-card transition hover:shadow-md"
        >
            <div className="relative aspect-square w-full bg-muted">
                {thumbnail ? (
                    <img
                        src={thumbnail.previewUrl ?? thumbnail.fileUrl}
                        alt={asset.title}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        No preview
                    </div>
                )}
                {asset.isAiGenerated && <AiBadge className="absolute left-2 top-2" />}
            </div>
            <div className="space-y-1 p-3">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-1 text-sm font-medium">{asset.title}</h3>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {CATEGORY_LABELS[asset.category]}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Avatar size="sm">
                        {asset.seller.avatarUrl && (
                            <AvatarImage src={asset.seller.avatarUrl} alt={asset.seller.name} />
                        )}
                        <AvatarFallback>
                            {asset.seller.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <span className="truncate">by {asset.seller.name}</span>
                </div>
                <p className="text-sm font-semibold">{startingPriceLabel(asset)}</p>
            </div>
        </Link>
    );
}
