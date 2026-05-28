import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { usePublicAsset } from "@/hooks/useAsset";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AiBadge } from "@/components/marketplace/AiBadge";
import type { AssetCategory, Currency } from "@/types/asset";
import { formatPrice, formatSol } from "@/lib/price";

const CATEGORY_LABELS: Record<AssetCategory, string> = {
    THREE_D_MODEL: "3D Model",
    IMAGE: "Image",
    VIDEO: "Video",
    SOUND_EFFECT: "Sound",
    FONT: "Font",
    ANIMATION: "Animation",
};

type LicenseTier = "PERSONAL" | "COMMERCIAL";

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractFileName(fileUrl: string): string {
    const last = fileUrl.split("/").pop() ?? "file";
    return last.replace(/^\d+-/, "");
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

    return <AssetDetailContent asset={asset} />;
}

type AssetData = NonNullable<ReturnType<typeof usePublicAsset>["data"]>;

function AssetDetailContent({ asset }: { asset: AssetData }) {
    const thumbnail = asset.files.find((f) => f.fileType.startsWith("image/"));
    const videoFile = asset.files.find((f) => f.fileType.startsWith("video/"));
    const audioFile = asset.files.find((f) => f.fileType.startsWith("audio/"));
    const fontFile = asset.files.find(
        (f) =>
            f.fileType.startsWith("font/") ||
            f.fileType.includes("font") ||
            /\.(ttf|otf|woff2?|eot)$/i.test(f.fileUrl),
    );
    const isBlockchain = asset.listingType === "BLOCKCHAIN";
    const hasPersonal = asset.pricePersonal !== null;
    const hasCommercial = asset.priceCommercial !== null;

    const [tier, setTier] = useState<LicenseTier>(hasPersonal ? "PERSONAL" : "COMMERCIAL");
    const [displayCurrency, setDisplayCurrency] = useState<Currency>(asset.currency);

    const fiatPrice = tier === "PERSONAL" ? asset.pricePersonal : asset.priceCommercial;
    const fiatLabel = formatPrice(fiatPrice, asset.currency, displayCurrency);
    const solLabel = formatSol(asset.priceSol);

    return (
        <div className="mx-auto max-w-6xl px-6 py-8">
            <div className="grid gap-8 md:grid-cols-2">
                <div className="aspect-square w-full overflow-hidden rounded-lg border bg-muted">
                    {videoFile && videoFile.previewUrl ? (
                        <video
                            src={videoFile.previewUrl}
                            controls
                            controlsList="nodownload"
                            className="h-full w-full object-cover"
                        />
                    ) : fontFile && fontFile.previewUrl ? (
                        <img
                            src={fontFile.previewUrl}
                            alt={asset.title}
                            className="h-full w-full object-contain bg-white"
                        />
                    ) : audioFile && audioFile.previewUrl ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
                            <div className="text-sm text-muted-foreground">Audio preview</div>
                            <audio
                                src={audioFile.previewUrl}
                                controls
                                controlsList="nodownload"
                                className="w-full"
                            />
                        </div>
                    ) : thumbnail ? (
                        <img
                            src={thumbnail.previewUrl ?? thumbnail.fileUrl}
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
                        <div className="space-y-2">
                            <h1 className="text-2xl font-semibold">{asset.title}</h1>
                            {asset.isAiGenerated && <AiBadge />}
                        </div>
                        <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs uppercase text-muted-foreground">
                            {CATEGORY_LABELS[asset.category]}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg border p-3">
                        <Avatar size="lg">
                            {asset.seller.avatarUrl && (
                                <AvatarImage
                                    src={asset.seller.avatarUrl}
                                    alt={asset.seller.name}
                                />
                            )}
                            <AvatarFallback>
                                {asset.seller.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">Seller</p>
                            <p className="truncate text-sm font-medium">{asset.seller.name}</p>
                        </div>
                    </div>

                    <div className="rounded-lg border p-4 space-y-3">
                        {isBlockchain ? (
                            <>
                                <p className="text-xs text-muted-foreground">Price</p>
                                <p className="text-2xl font-semibold">{solLabel}</p>
                                <Button
                                    className="w-full"
                                    size="lg"
                                    disabled={asset.priceSol === null}
                                    title="Purchase flow coming soon"
                                >
                                    {asset.priceSol === null
                                        ? "Not for sale"
                                        : `Buy for ${solLabel}`}
                                </Button>
                            </>
                        ) : (
                            <>
                                <div>
                                    <p className="mb-2 text-xs text-muted-foreground">License</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setTier("PERSONAL")}
                                            disabled={!hasPersonal}
                                            className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                                                tier === "PERSONAL"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-foreground/30"
                                            } ${!hasPersonal ? "opacity-40 cursor-not-allowed" : ""}`}
                                        >
                                            <div className="font-medium">Personal</div>
                                            <div className="text-xs text-muted-foreground">
                                                {formatPrice(
                                                    asset.pricePersonal,
                                                    asset.currency,
                                                    displayCurrency,
                                                )}
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTier("COMMERCIAL")}
                                            disabled={!hasCommercial}
                                            className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                                                tier === "COMMERCIAL"
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-foreground/30"
                                            } ${!hasCommercial ? "opacity-40 cursor-not-allowed" : ""}`}
                                        >
                                            <div className="font-medium">Commercial</div>
                                            <div className="text-xs text-muted-foreground">
                                                {formatPrice(
                                                    asset.priceCommercial,
                                                    asset.currency,
                                                    displayCurrency,
                                                )}
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground">Show in</p>
                                    <div className="flex gap-1 text-xs">
                                        {(["USD", "MYR"] as Currency[]).map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setDisplayCurrency(c)}
                                                className={`rounded px-2 py-1 ${
                                                    displayCurrency === c
                                                        ? "bg-foreground text-background"
                                                        : "bg-muted text-muted-foreground"
                                                }`}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <p className="text-2xl font-semibold">{fiatLabel}</p>
                                <Button
                                    className="w-full"
                                    size="lg"
                                    disabled={fiatPrice === null}
                                    title="Purchase flow coming soon"
                                >
                                    {fiatPrice === null
                                        ? "Tier not available"
                                        : `Buy for ${fiatLabel}`}
                                </Button>
                            </>
                        )}
                        <p className="text-center text-xs text-muted-foreground">
                            Purchase flow coming soon
                        </p>
                    </div>

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

            <div className="mt-10">
                <h2 className="mb-3 text-sm font-medium">
                    Files included ({asset.files.length})
                </h2>
                {asset.files.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No files attached.</p>
                ) : (
                    <ul className="divide-y rounded-lg border">
                        {asset.files.map((file) => (
                            <li
                                key={file.id}
                                className="flex items-center justify-between gap-4 px-4 py-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                        {extractFileName(file.fileUrl)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {file.fileType}
                                    </p>
                                </div>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                    {formatFileSize(file.fileSize)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                    Files are available for download after purchase.
                </p>
            </div>
        </div>
    );
}
