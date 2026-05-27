import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { BrowseAssetItem } from "@/types/asset";

const CATEGORY_LABELS: Record<BrowseAssetItem["category"], string> = {
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

export default function AssetCard({ asset }: { asset: BrowseAssetItem }) {
    const thumbnail = asset.files.find((f) => f.fileType.startsWith("image/"));

    return (
        <Link
            to={`/assets/${asset.id}`}
            className="group block overflow-hidden rounded-lg border bg-card transition hover:shadow-md"
        >
            <div className="aspect-square w-full bg-muted">
                {thumbnail ? (
                    <img
                        src={thumbnail.fileUrl}
                        alt={asset.title}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        No preview
                    </div>
                )}
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
                <p className="text-sm font-semibold">{formatPrice(asset.pricePersonal)}</p>
            </div>
        </Link>
    );
}
