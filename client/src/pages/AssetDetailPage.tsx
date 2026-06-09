import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
    usePublicAsset,
    useRelatedAssets,
    useAssetReviews,
    useSubmitReview,
    useDeleteReview,
} from "@/hooks/useAsset";
import { useAddToCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { savePendingCartItem } from "@/lib/cartIntent";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AiBadge } from "@/components/marketplace/AiBadge";
import AssetCard from "@/components/marketplace/AssetCard";
import ModelViewer from "@/components/marketplace/ModelViewer";
import StarRating from "@/components/marketplace/StarRating";
import type { AssetCategory } from "@/types/asset";
import { formatPrice, formatSol } from "@/lib/price";
import { shopDisplay } from "@/lib/store";
import { useCurrencyStore } from "@/stores/currencyStore";

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
type ReviewData = NonNullable<ReturnType<typeof useAssetReviews>["data"]>["items"][number];

function AssetDetailContent({ asset }: { asset: AssetData }) {
    const shop = shopDisplay(asset.seller);
    const thumbnail = asset.files.find((f) => f.fileType.startsWith("image/"));
    const videoFile = asset.files.find((f) => f.fileType.startsWith("video/"));
    const audioFile = asset.files.find((f) => f.fileType.startsWith("audio/"));
    // The ModelViewer loads this file's URL directly into the public page, so it
    // MUST be the PREVIEW glb. The high-poly ORIGINAL glb lives in a private S3
    // prefix and would 404 — and loading it would leak the paid file for free.
    const glbFile = asset.files.find(
        (f) => f.purpose === "PREVIEW" && /\.glb$/i.test(f.fileUrl),
    );
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
    const displayCurrency = useCurrencyStore((s) => s.displayCurrency);

    const { data: related } = useRelatedAssets(asset.id);
    const relatedItems = related?.items ?? [];

    const { user } = useAuth();
    const navigate = useNavigate();
    const isAdmin = user?.roles.includes("ADMIN") ?? false;
    const isGuest = !user;
    const canAddToCart = !isAdmin; // guests and buyers can; admins cannot
    const addToCart = useAddToCart();
    const [cartMessage, setCartMessage] = useState<string | null>(null);

    const handleAddToCart = () => {
        // Guest: save the intent and send them to log in. After login the app
        // auto-adds it and lands them on /cart (see useCartIntent).
        if (isGuest) {
            savePendingCartItem({ assetId: asset.id, licenseType: tier });
            navigate("/login");
            return;
        }

        setCartMessage(null);
        addToCart.mutate(
            { assetId: asset.id, licenseType: tier },
            {
                onSuccess: () => setCartMessage("Added to cart"),
                onError: (err) => {
                    const status = (err as { response?: { status?: number } }).response?.status;
                    setCartMessage(
                        status === 409 ? "Already in your cart" : "Could not add to cart",
                    );
                },
            },
        );
    };

    const fiatPrice = tier === "PERSONAL" ? asset.pricePersonal : asset.priceCommercial;
    const fiatLabel = formatPrice(fiatPrice, asset.currency, displayCurrency);
    const solLabel = formatSol(asset.priceSol);

    return (
        <div className="mx-auto max-w-6xl px-6 py-8">
            <div className="grid gap-8 md:grid-cols-2">
                <div className="aspect-square w-full overflow-hidden rounded-lg border bg-muted">
                    {asset.category === "THREE_D_MODEL" && glbFile ? (
                        <ModelViewer
                            src={glbFile.fileUrl}
                            alt={asset.title}
                            poster={thumbnail?.previewUrl ?? thumbnail?.fileUrl}
                        />
                    ) : asset.category === "THREE_D_MODEL" && !glbFile ? (
                        thumbnail ? (
                            <img
                                src={thumbnail.previewUrl ?? thumbnail.fileUrl}
                                alt={asset.title}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                                Interactive 3D preview unavailable for this listing.
                            </div>
                        )
                    ) : videoFile && videoFile.previewUrl ? (
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
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {asset.reviewCount > 0 ? (
                                    <>
                                        <StarRating value={asset.averageRating} />
                                        <span>
                                            {asset.averageRating.toFixed(1)} ·{" "}
                                            {asset.reviewCount}{" "}
                                            {asset.reviewCount === 1 ? "review" : "reviews"}
                                        </span>
                                    </>
                                ) : (
                                    <span>No reviews yet</span>
                                )}
                            </div>
                            {asset.isAiGenerated && <AiBadge />}
                        </div>
                        <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs uppercase text-muted-foreground">
                            {CATEGORY_LABELS[asset.category]}
                        </span>
                    </div>

                    <Link
                        to={`/stores/${asset.seller.userId}`}
                        className="flex items-center gap-3 rounded-lg border p-3 transition hover:bg-muted/50"
                    >
                        <Avatar size="lg">
                            {shop.logoUrl && <AvatarImage src={shop.logoUrl} alt={shop.name} />}
                            <AvatarFallback>{shop.initial}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">Shop</p>
                            <p className="truncate text-sm font-medium">{shop.name}</p>
                        </div>
                    </Link>

                    <div className="rounded-lg border p-4 space-y-3">
                        {isBlockchain ? (
                            <>
                                <p className="text-xs text-muted-foreground">Price</p>
                                <p className="text-2xl font-semibold">{solLabel}</p>
                                <Button
                                    className="w-full"
                                    size="lg"
                                    disabled={asset.priceSol === null}
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

                                <p className="text-2xl font-semibold">{fiatLabel}</p>
                                <Button
                                    className="w-full"
                                    size="lg"
                                    disabled={fiatPrice === null}
                                >
                                    {fiatPrice === null
                                        ? "Tier not available"
                                        : `Buy for ${fiatLabel}`}
                                </Button>
                                {canAddToCart && (
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        size="lg"
                                        disabled={fiatPrice === null || addToCart.isPending}
                                        onClick={handleAddToCart}
                                    >
                                        {addToCart.isPending ? "Adding…" : "Add to cart"}
                                    </Button>
                                )}
                                {cartMessage && (
                                    <p className="text-center text-xs text-muted-foreground">
                                        {cartMessage}
                                    </p>
                                )}
                            </>
                        )}
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

            <ReviewsSection asset={asset} />

            {relatedItems.length > 0 && (
                <div className="mt-10">
                    <h2 className="mb-3 text-sm font-medium">Related assets</h2>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                        {relatedItems.map((item) => (
                            <AssetCard key={item.id} asset={item} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function formatReviewDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function ReviewsSection({ asset }: { asset: AssetData }) {
    const { user } = useAuth();
    const { data, isLoading } = useAssetReviews(asset.id);
    const reviews = data?.items ?? [];

    // The JWT carries the user id as `sub` (a string); review.userId/sellerId are numbers.
    const userId = user ? Number(user.sub) : null;
    const isAdmin = user?.roles.includes("ADMIN") ?? false;
    const isSeller = userId === asset.sellerId;
    // Form shows for any logged-in non-admin who isn't the seller. Whether they
    // actually bought it is enforced by the API (403 surfaced on submit).
    const canShowForm = !!user && !isAdmin && !isSeller;
    const myReview = userId !== null ? reviews.find((r) => r.userId === userId) ?? null : null;

    // When the buyer already has a review, hide the form until they click "Edit"
    // on their own review — otherwise the form duplicates what's shown below.
    const [isEditing, setIsEditing] = useState(false);

    return (
        <div className="mt-10">
            <h2 className="mb-3 text-sm font-medium">
                Ratings &amp; reviews ({asset.reviewCount})
            </h2>

            {canShowForm && (!myReview || isEditing) && (
                <ReviewForm
                    assetId={asset.id}
                    existingReview={myReview}
                    onClose={() => setIsEditing(false)}
                />
            )}

            {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading reviews…</p>
            ) : reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No reviews yet. Be the first to review this asset.
                </p>
            ) : (
                <ul className="divide-y rounded-lg border">
                    {reviews.map((review) => (
                        <li key={review.id} className="flex gap-3 px-4 py-3">
                            <Avatar size="sm">
                                {review.user.avatarUrl && (
                                    <AvatarImage
                                        src={review.user.avatarUrl}
                                        alt={review.user.name}
                                    />
                                )}
                                <AvatarFallback>
                                    {review.user.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-medium">
                                        {review.user.name}
                                    </span>
                                    <StarRating value={review.rating} size={14} />
                                    <span className="text-xs text-muted-foreground">
                                        {formatReviewDate(review.createdAt)}
                                    </span>
                                    {review.id === myReview?.id && !isEditing && (
                                        <button
                                            type="button"
                                            onClick={() => setIsEditing(true)}
                                            className="text-xs font-medium text-primary hover:underline"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </div>
                                {review.comment && (
                                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                        {review.comment}
                                    </p>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function ReviewForm({
    assetId,
    existingReview,
    onClose,
}: {
    assetId: number;
    existingReview: ReviewData | null;
    onClose: () => void;
}) {
    const [rating, setRating] = useState<number>(existingReview?.rating ?? 0);
    const [comment, setComment] = useState<string>(existingReview?.comment ?? "");
    const [message, setMessage] = useState<string | null>(null);

    const submit = useSubmitReview();
    const remove = useDeleteReview();
    const isEditing = existingReview !== null;

    const handleSubmit = (e: { preventDefault: () => void }) => {
        e.preventDefault();
        if (rating < 1) {
            setMessage("Please select a rating.");
            return;
        }
        setMessage(null);
        submit.mutate(
            { assetId, payload: { rating, comment: comment.trim() || undefined } },
            {
                onSuccess: () => {
                    setMessage(isEditing ? "Review updated" : "Review submitted");
                    if (isEditing) onClose();
                },
                onError: (err) => {
                    const status = (err as { response?: { status?: number } }).response?.status;
                    setMessage(
                        status === 403
                            ? "Only buyers who purchased this asset can leave a review."
                            : "Could not submit review.",
                    );
                },
            },
        );
    };

    const handleDelete = () => {
        setMessage(null);
        remove.mutate(assetId, {
            onSuccess: () => {
                setRating(0);
                setComment("");
                setMessage("Review removed");
                onClose();
            },
            onError: () => setMessage("Could not remove review."),
        });
    };

    return (
        <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">
                {isEditing ? "Edit your review" : "Write a review"}
            </p>
            <StarRating value={rating} size={24} onChange={setRating} />
            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share what you think about this asset (optional)"
                rows={3}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-2">
                <Button type="submit" disabled={submit.isPending}>
                    {submit.isPending
                        ? "Saving…"
                        : isEditing
                          ? "Update review"
                          : "Submit review"}
                </Button>
                {isEditing && (
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={remove.isPending}
                            onClick={handleDelete}
                        >
                            {remove.isPending ? "Removing…" : "Delete"}
                        </Button>
                        <Button type="button" variant="ghost" onClick={onClose}>
                            Cancel
                        </Button>
                    </>
                )}
            </div>
            {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </form>
    );
}
