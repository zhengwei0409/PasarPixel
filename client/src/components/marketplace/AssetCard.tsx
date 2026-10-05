import { Link, useNavigate } from "react-router-dom";
import { ImageIcon, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AiBadge } from "@/components/marketplace/AiBadge";
import StarRating from "@/components/marketplace/StarRating";
import type { BrowseAssetItem, Currency } from "@/types/asset";
import { formatPrice, formatSol } from "@/lib/price";
import { shopDisplay } from "@/lib/store";
import { useCurrencyStore } from "@/stores/currencyStore";

const CATEGORY_LABELS: Record<BrowseAssetItem["category"], string> = {
    THREE_D_MODEL: "3D Model",
    IMAGE: "Image",
    VIDEO: "Video",
    SOUND_EFFECT: "Sound",
    FONT: "Font",
    ANIMATION: "Animation",
};

function startingPriceLabel(asset: BrowseAssetItem, displayCurrency: Currency): string {
    if (asset.listingType === "BLOCKCHAIN") {
        return formatSol(asset.priceSol);
    }
    const prices = [asset.pricePersonal, asset.priceCommercial]
        .map((p) => (p === null ? null : parseFloat(p)))
        .filter((n): n is number => n !== null && !isNaN(n));
    if (prices.length === 0) return "—";
    const min = Math.min(...prices);
    if (min === 0) return "Free";
    return `from ${formatPrice(min, asset.currency, displayCurrency)}`;
}

// The marketplace card only shows a STATIC image. Image files use their own
// preview/original; fonts have a rendered .png preview. Video/audio previews
// are clips, not images, so we skip them and fall back to "No preview".
function cardThumbnailUrl(asset: BrowseAssetItem): string | null {
    const image = asset.files.find((f) => f.fileType.startsWith("image/"));
    if (image) return image.previewUrl ?? image.fileUrl;

    const font = asset.files.find((f) => f.fileType.startsWith("font/") && f.previewUrl);
    if (font) return font.previewUrl;

    return null;
}

export default function AssetCard({ asset, variant = "default" }: {
    asset: BrowseAssetItem;
    variant?: "default" | "featured" | "compact";
}) {
    const thumbnailUrl = cardThumbnailUrl(asset);
    const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
    const shop = shopDisplay(asset.seller);
    const navigate = useNavigate();

    return (
        <Link
            to={`/assets/${asset.id}`}
            className={cn(
                "group block overflow-hidden rounded-lg border bg-card transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568] motion-reduce:transition-none",
                variant !== "default" && "rounded-xl border-[#e7e9e1] bg-white text-[#252823] hover:border-[#c5cfb5] hover:shadow-[0_8px_24px_-16px_rgba(37,40,35,0.25)]",
            )}
        >
            <div className={cn("relative w-full overflow-hidden bg-muted", variant === "default" ? "aspect-square" : variant === "featured" ? "aspect-[16/10] bg-[#e9ecdf]" : "aspect-[4/3] bg-[#e9ecdf]")}>
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={asset.title}
                        loading="lazy"
                        className={cn("h-full w-full transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none", variant === "default" ? "object-contain" : "object-cover")}
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-xs text-[#73776e]">
                        {variant !== "default" && <ImageIcon className="size-8 text-[#9ca98c]" aria-hidden="true" />}
                        {variant === "default" ? "No preview" : CATEGORY_LABELS[asset.category]}
                    </div>
                )}
                {asset.isAiGenerated && <AiBadge className="absolute left-2 top-2" />}
            </div>
            {variant !== "default" ? (
                <div className={cn("space-y-2.5", variant === "featured" ? "p-5" : "p-4")}>
                    <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 truncate text-sm font-medium tracking-[-0.02em]">{asset.title}</h3>
                        <span className="shrink-0 text-xs font-semibold text-[#555e49]">{startingPriceLabel(asset, displayCurrency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs text-[#73776e]">
                        <span className="min-w-0 truncate">By {shop.name}</span>
                        {asset.reviewCount > 0 && (
                            <span className="flex shrink-0 items-center gap-1" aria-label={`${asset.averageRating.toFixed(1)} out of 5 stars`}>
                                <Star className="size-3 fill-[#9ca98c] text-[#9ca98c]" aria-hidden="true" />
                                {asset.averageRating.toFixed(1)}
                            </span>
                        )}
                    </div>
                    {variant === "compact" && <p className="text-[10px] tracking-wide text-[#85897f]">{CATEGORY_LABELS[asset.category]}</p>}
                </div>
            ) : (
                <div className="space-y-1 p-3">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-1 text-sm font-medium">{asset.title}</h3>
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                            {CATEGORY_LABELS[asset.category]}
                        </span>
                    </div>
                    <div
                        role="link"
                        tabIndex={0}
                        onClick={(e) => {
                            e.preventDefault();
                            navigate(`/stores/${asset.seller.userId}`);
                        }}
                        className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                        <Avatar size="sm">
                            {shop.logoUrl && <AvatarImage src={shop.logoUrl} alt={shop.name} />}
                            <AvatarFallback>{shop.initial}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{shop.name}</span>
                    </div>
                    <p className="text-sm font-semibold">{startingPriceLabel(asset, displayCurrency)}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {asset.reviewCount > 0 ? (
                            <>
                                <StarRating value={asset.averageRating} size={12} />
                                <span>
                                    {asset.averageRating.toFixed(1)} ({asset.reviewCount})
                                </span>
                            </>
                        ) : (
                            <span className="text-muted-foreground/60">No reviews</span>
                        )}
                    </div>
                </div>
            )}
        </Link>
    );
}
