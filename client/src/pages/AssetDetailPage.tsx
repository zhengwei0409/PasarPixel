import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Flag,
  ShoppingCart,
  Share2,
} from "lucide-react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  usePublicAsset,
  useRelatedAssets,
  useAssetReviews,
  useSubmitReview,
  useDeleteReview,
  useReviewEligibility,
  useSellerReply,
} from "@/hooks/useAsset";
import { useAddToCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { savePendingCartItem } from "@/lib/cartIntent";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AiBadge } from "@/components/marketplace/AiBadge";
import AssetCard from "@/components/marketplace/AssetCard";
import ReportDialog from "@/components/marketplace/ReportDialog";
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
  SOUND_EFFECT: "Audio",
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
  return (
    <main className="asset-detail-theme overflow-x-clip min-h-[calc(100dvh-73px)] bg-background text-foreground">
      <AssetDetailPageContent />
    </main>
  );
}

function AssetDetailPageContent() {
  const { id } = useParams<{ id: string }>();
  const assetId = id ? parseInt(id, 10) : NaN;
  const validId = !isNaN(assetId);

  const {
    data: asset,
    isLoading,
    error,
  } = usePublicAsset(validId ? assetId : null);

  if (!validId) {
    return (
      <div className="mx-auto max-w-[1064px] px-6 py-8">
        <p className="text-destructive">Invalid asset id.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1064px] px-6 py-8">
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
      <div className="mx-auto max-w-[1064px] px-6 py-8 text-center">
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

  return <AssetDetailContent key={asset.id} asset={asset} />;
}

type AssetData = NonNullable<ReturnType<typeof usePublicAsset>["data"]>;
type ReviewData = NonNullable<
  ReturnType<typeof useAssetReviews>["data"]
>["items"][number];

function AssetDetailContent({ asset }: { asset: AssetData }) {
  const shop = shopDisplay(asset.seller);
  const thumbnail = asset.files.find((f) => f.fileType.startsWith("image/"));
  const videoFile = asset.files.find((f) => f.fileType.startsWith("video/"));
  // The watermarked previewUrl is the source for a VIDEO listing. ANIMATION
  // uploads its video as a PREVIEW-purpose public file, so the backend skips
  // preview generation (previewUrl is null) — the file itself is the clip, so
  // fall back to fileUrl only when it's safe: a PREVIEW file is never the paid
  // ORIGINAL, so this can't leak the purchased download.
  const videoPreviewSrc =
    videoFile?.previewUrl ??
    (videoFile?.purpose === "PREVIEW" ? videoFile.fileUrl : null);
  const audioFile = asset.files.find((f) => f.fileType.startsWith("audio/"));
  // Reused source GLBs have a public preview copy; originals stay private.
  const glbFile = asset.files.find(f => f.purpose === "PREVIEW" && /\.glb$/i.test(f.fileUrl))
    ?? asset.files.find(f => /\.glb$/i.test(f.fileUrl) && !!f.previewUrl);
  const glbPreviewSrc = glbFile?.purpose === "PREVIEW" ? glbFile.fileUrl : glbFile?.previewUrl;
  const fontFile = asset.files.find(
    (f) =>
      f.fileType.startsWith("font/") ||
      f.fileType.includes("font") ||
      /\.(ttf|otf|woff2?|eot)$/i.test(f.fileUrl),
  );
  const isBlockchain = asset.listingType === "BLOCKCHAIN";
  const hasPersonal = asset.pricePersonal !== null;
  const hasCommercial = asset.priceCommercial !== null;

  const [tier, setTier] = useState<LicenseTier>(
    hasPersonal ? "PERSONAL" : "COMMERCIAL",
  );
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
  const [reportOpen, setReportOpen] = useState(false);

  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage("Link copied");
    } catch {
      setShareMessage("Could not copy link");
    }
  };

  const handleReportClick = () => {
    if (isAdmin) return;
    if (isGuest) {
      navigate("/login");
      return;
    }
    setReportOpen(true);
  };

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
          const status = (err as { response?: { status?: number } }).response
            ?.status;
          setCartMessage(
            status === 409 ? "Already in your cart" : "Could not add to cart",
          );
        },
      },
    );
  };

  const fiatPrice =
    tier === "PERSONAL" ? asset.pricePersonal : asset.priceCommercial;
  const solLabel = formatSol(asset.priceSol);

  return (
    <div className="mx-auto max-w-[1064px] px-4 py-8 sm:px-8 lg:py-12">
      <Link
        to="/marketplace"
        className="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft size={14} /> Back to marketplace
      </Link>
      <div className="grid min-w-0 items-start gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="min-w-0">
          <div className="mx-auto aspect-square w-full max-w-[440px] overflow-hidden rounded-2xl border border-border bg-muted shadow-[0_2px_8px_rgba(37,40,35,0.04)] lg:mx-0">
            {asset.category === "THREE_D_MODEL" && glbFile ? (
              <ModelViewer
                src={glbPreviewSrc!}
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
            ) : videoPreviewSrc ? (
              <video
                src={videoPreviewSrc}
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
                <div className="text-sm text-muted-foreground">
                  Audio preview
                </div>
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

          <div className="mt-8 grid grid-cols-3 gap-4 border-b pb-7">
            {[
              { label: "Category", value: CATEGORY_LABELS[asset.category] },
              { label: "Files", value: String(asset.files.length) },
              { label: "Delivery", value: "Digital download" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {label}
                </p>
                <p className="text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <div className="py-8">
            <h2 className="mb-3 text-xl font-semibold">About this asset</h2>
            <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
              {asset.description ||
                "The seller has not added a description yet."}
            </p>
          </div>
        </div>

        <aside className="min-w-0 space-y-6">
          <div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
              {CATEGORY_LABELS[asset.category]}
            </span>
            <h1 className="mt-4 break-words text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {asset.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {asset.reviewCount > 0 ? (
                <>
                  <StarRating value={asset.averageRating} />
                  <span>
                    {asset.averageRating.toFixed(1)} · {asset.reviewCount}{" "}
                    reviews
                  </span>
                </>
              ) : (
                <span>No reviews yet</span>
              )}
              {asset.isAiGenerated && <AiBadge />}
            </div>
          </div>

          {isBlockchain ? (
            <div className="rounded-xl border p-5">
              <p className="text-xs text-muted-foreground">Blockchain asset</p>
              <p className="mt-2 text-2xl font-semibold">{solLabel}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {asset.priceSol === null
                  ? "Not for sale"
                  : "Blockchain checkout is not available yet."}
              </p>
            </div>
          ) : (
            <div
              className="space-y-3"
              role="group"
              aria-label="Choose a license"
            >
              {(["PERSONAL", "COMMERCIAL"] as const).map((license) => {
                const available =
                  license === "PERSONAL" ? hasPersonal : hasCommercial;
                return (
                  <button
                    key={license}
                    type="button"
                    aria-pressed={tier === license}
                    disabled={!available}
                    onClick={() => setTier(license)}
                    className={`flex w-full items-start justify-between gap-4 rounded-xl border-2 p-5 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${tier === license ? "border-primary bg-primary/5" : "border-border bg-white hover:border-[#c5cfb5]"}`}
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {license === "PERSONAL"
                          ? "Personal license"
                          : "Commercial license"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {license === "PERSONAL"
                          ? "For personal projects"
                          : "For commercial projects"}
                      </p>
                    </div>
                    <span className="shrink-0 text-lg font-semibold">
                      {available
                        ? formatPrice(
                            license === "PERSONAL"
                              ? asset.pricePersonal
                              : asset.priceCommercial,
                            asset.currency,
                            displayCurrency,
                          )
                        : "Unavailable"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {!isBlockchain && canAddToCart && (
            <div className="space-y-2">
              <Button
                className="h-12 w-full rounded-lg hover:bg-[#444f3a]"
                disabled={fiatPrice === null || addToCart.isPending}
                onClick={handleAddToCart}
              >
                <ShoppingCart size={16} />{" "}
                {addToCart.isPending ? "Adding…" : "Add to cart"}
              </Button>
              {cartMessage && (
                <p
                  role="status"
                  className="text-center text-xs text-muted-foreground"
                >
                  {cartMessage}
                </p>
              )}
            </div>
          )}
          <div className={`grid gap-3 ${isAdmin ? "grid-cols-1" : "grid-cols-2"}`}>
            <Button
              variant="secondary"
              className="h-10 text-xs"
              onClick={handleShare}
            >
              <Share2 size={14} /> Share
            </Button>
            {!isAdmin && (
              <Button
                variant="secondary"
                className="h-10 text-xs"
                onClick={handleReportClick}
              >
                <Flag size={14} /> Report asset
              </Button>
            )}
          </div>
          {shareMessage && (
            <p role="status" className="text-xs text-muted-foreground">
              {shareMessage}
            </p>
          )}
          <Link
            to={`/stores/${asset.seller.userId}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 transition hover:border-[#c5cfb5]"
          >
            <Avatar size="lg">
              {shop.logoUrl && (
                <AvatarImage src={shop.logoUrl} alt={shop.name} />
              )}
              <AvatarFallback>{shop.initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{shop.name}</p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                Creator store
              </p>
            </div>
            <span className="flex items-center gap-1 text-xs">
              Portfolio <ArrowUpRight size={14} />
            </span>
          </Link>
          {!isAdmin && (
            <ReportDialog
              assetId={asset.id}
              open={reportOpen}
              onOpenChange={setReportOpen}
            />
          )}
        </aside>
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
  const isSeller = userId === asset.sellerId;
  const { data: eligibility } = useReviewEligibility(asset.id, user?.sub);
  const canShowForm = eligibility?.canReview === true;
  const myReview =
    userId !== null ? (reviews.find((r) => r.userId === userId) ?? null) : null;

  // When the buyer already has a review, hide the form until they click "Edit"
  // on their own review — otherwise the form duplicates what's shown below.
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="mt-12 border-t pt-8">
      <h2 className="mb-5 text-xl font-semibold">
        Ratings &amp; reviews ({asset.reviewCount})
      </h2>

      {canShowForm && (!myReview || isEditing) && (
        <ReviewForm
          assetId={asset.id}
          existingReview={myReview}
          onClose={() => setIsEditing(false)}
        />
      )}

      {!canShowForm && !isSeller && (
        <p className="mb-5 text-sm text-muted-foreground">
          Purchase this asset to share your rating and review.
        </p>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reviews yet. Be the first to review this asset.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="flex gap-3 rounded-xl border border-border bg-white p-5"
            >
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
                <SellerReply
                  review={review}
                  canReply={isSeller && !!user?.roles.includes("SELLER")}
                />
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
          const status = (err as { response?: { status?: number } }).response
            ?.status;
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
    <form
      onSubmit={handleSubmit}
      className="mb-6 space-y-3 rounded-lg border p-4"
    >
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

function SellerReply({
  review,
  canReply,
}: {
  review: ReviewData;
  canReply: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [reply, setReply] = useState(review.sellerReply ?? "");
  const mutation = useSellerReply();
  return (
    <div className="pt-3">
      {review.sellerReply && (
        <div className="rounded-lg border-l-2 border-primary/40 bg-background/70 p-3">
          <p className="mb-1 text-xs font-semibold">Seller reply</p>
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {review.sellerReply}
          </p>
          {review.sellerReplyUpdatedAt && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Updated {formatReviewDate(review.sellerReplyUpdatedAt)}
            </p>
          )}
        </div>
      )}
      {canReply &&
        (editing ? (
          <form
            className="mt-3 space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate(
                { assetId: review.assetId, reviewId: review.id, reply },
                { onSuccess: () => setEditing(false) },
              );
            }}
          >
            <label
              className="text-xs font-medium"
              htmlFor={`reply-${review.id}`}
            >
              Your reply
            </label>
            <textarea
              id={`reply-${review.id}`}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              maxLength={2000}
              required
              rows={3}
              className="w-full rounded-lg border bg-background p-3 text-sm"
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={!reply.trim() || mutation.isPending}
              >
                {mutation.isPending ? "Saving…" : "Save reply"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
            {mutation.isError && (
              <p role="alert" className="text-xs text-destructive">
                Could not save your reply. Please try again.
              </p>
            )}
          </form>
        ) : (
          <button
            type="button"
            className="mt-2 text-xs font-medium text-primary hover:underline"
            onClick={() => {
              setReply(review.sellerReply ?? "");
              mutation.reset();
              setEditing(true);
            }}
          >
            {review.sellerReply ? "Edit reply" : "Reply to review"}
          </button>
        ))}
    </div>
  );
}
