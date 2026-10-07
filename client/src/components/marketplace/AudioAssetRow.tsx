import { useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoaderCircle, Pause, Play, ShoppingCart } from "lucide-react";
import { useAudioPreview } from "@/hooks/useAudioPreview";
import { useAddToCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { savePendingCartItem } from "@/lib/cartIntent";
import { shopDisplay } from "@/lib/store";
import { formatPrice, formatSol } from "@/lib/price";
import { useCurrencyStore } from "@/stores/currencyStore";
import type { BrowseAssetItem } from "@/types/asset";
import type { LicenseType } from "@/types/cart";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]";

function timestamp(seconds: number) {
    const value = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export default function AudioAssetRow({ asset }: { asset: BrowseAssetItem }) {
    // Only public previews are safe to use; never fall back to a paid original.
    const previewFile = asset.files.find((file) => file.fileType.startsWith("audio/") && (file.previewUrl || file.purpose === "PREVIEW"));
    const src = previewFile?.previewUrl ?? (previewFile?.purpose === "PREVIEW" ? previewFile.fileUrl : null);
    const {
        audioRef, playing, currentTime, duration, playbackError, waveform,
        togglePlayback, seek, claimPlayback, setPlaying, setCurrentTime, setDuration, onPlaybackError,
    } = useAudioPreview(src);
    const clipId = useId();
    const shop = shopDisplay(asset.seller);
    const { user } = useAuth();
    const navigate = useNavigate();
    const addToCart = useAddToCart();
    const [cartMessage, setCartMessage] = useState<string | null>(null);
    const displayCurrency = useCurrencyStore((state) => state.displayCurrency);
    const licenseType: LicenseType = asset.pricePersonal !== null ? "PERSONAL" : "COMMERCIAL";
    const price = licenseType === "PERSONAL" ? asset.pricePersonal : asset.priceCommercial;
    const isBlockchain = asset.listingType === "BLOCKCHAIN";
    const cartDisabled = user?.roles.includes("ADMIN") || addToCart.isPending || (!isBlockchain && price === null);
    const priceLabel = isBlockchain ? formatSol(asset.priceSol) : price === null ? "—" : Number(price) === 0 ? "Free" : formatPrice(Number(price), asset.currency, displayCurrency);
    const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
    const peaks = waveform.data;
    const upper = peaks?.map((peak, index) => `${index * 1000 / Math.max(1, peaks.length - 1)},${30 - Math.max(0.5, peak * 26)}`) ?? [];
    const lower = peaks?.map((peak, index) => `${index * 1000 / Math.max(1, peaks.length - 1)},${30 + Math.max(0.5, peak * 26)}`).reverse() ?? [];
    const waveformPath = peaks ? `M${upper.join(" L")} L${lower.join(" L")} Z` : "M0 30 L1000 30";

    const handleAddToCart = () => {
        if (isBlockchain) {
            navigate(`/assets/${asset.id}`);
            return;
        }
        const payload = { assetId: asset.id, licenseType };
        if (!user) {
            savePendingCartItem(payload);
            navigate("/login");
            return;
        }
        setCartMessage(null);
        addToCart.mutate(payload, {
            onSuccess: () => setCartMessage("Added to cart"),
            onError: (error) => setCartMessage((error as { response?: { status?: number } }).response?.status === 409 ? "Already in your cart" : "Could not add to cart. Please try again."),
        });
    };

    return (
        <article className="relative isolate col-span-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b border-[#e7e9e1] bg-white px-4 py-6 transition-colors hover:bg-[#fcfcfa] sm:gap-x-5 sm:px-5 lg:grid-cols-[auto_minmax(120px,180px)_minmax(0,1fr)_auto]">
            <audio
                hidden
                ref={audioRef}
                src={src ?? undefined}
                preload="metadata"
                onPlay={claimPlayback}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
                onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
                onError={onPlaybackError}
            />
            <button type="button" onClick={() => void togglePlayback()} disabled={!src} aria-label={`${playing ? "Pause" : "Play"} ${asset.title}`} className={`relative z-10 flex size-12 items-center justify-center rounded-full border border-[#dfe4d6] text-[#30392b] hover:bg-[#f1f3eb] disabled:opacity-40 ${FOCUS}`}>
                {playing ? <Pause className="size-5 fill-current" aria-hidden="true" /> : <Play className="ml-0.5 size-5 fill-current" aria-hidden="true" />}
            </button>
            <div className="min-w-0">
                <Link to={`/assets/${asset.id}`} className={`block truncate after:absolute after:inset-0 after:content-[''] text-sm font-semibold text-[#252823] hover:underline ${FOCUS}`}>{asset.title}</Link>
                <Link to={`/stores/${asset.seller.userId}`} className={`relative z-10 mt-1 block truncate text-xs text-[#73776e] hover:underline ${FOCUS}`}>By {shop.name}</Link>
                <p className="mt-1 text-xs text-[#555e49]">{priceLabel}</p>
            </div>
            <div className="col-span-full row-start-2 min-w-0 lg:col-span-1 lg:col-start-3 lg:row-start-1">
                <div className="relative z-10 h-14 rounded-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-[#7a8568]">
                    <svg viewBox="0 0 1000 60" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
                        <defs><clipPath id={clipId}><rect width={progress * 1000} height="60" /></clipPath></defs>
                        <path d={waveformPath} fill={peaks ? "#91968b" : "none"} stroke="#91968b" strokeWidth="1" />
                        <path d={waveformPath} fill={peaks ? "#657152" : "none"} stroke="#657152" strokeWidth="1" clipPath={`url(#${clipId})`} />
                        {duration > 0 && <line x1={progress * 1000} x2={progress * 1000} y1="3" y2="57" stroke="#30392b" strokeWidth="2" />}
                    </svg>
                    <input type="range" min="0" max={duration || 1} step="0.01" value={Math.min(currentTime, duration || 1)} onChange={(event) => seek(Number(event.target.value))} disabled={!src || duration <= 0} aria-label={`Seek ${asset.title}`} aria-valuetext={`${timestamp(currentTime)} of ${timestamp(duration)}`} className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default" />
                </div>
                <div className="flex justify-between gap-3 text-[10px] text-[#85897f]">
                    <span role="status">{playbackError ?? (!src ? "Preview unavailable" : waveform.isPending ? "Loading waveform…" : waveform.isError ? "Waveform unavailable · preview can still play" : "Audio preview")}</span>
                    {src && <span className="shrink-0 tabular-nums">{timestamp(currentTime)} / {timestamp(duration)}</span>}
                </div>
            </div>
            <div className="col-start-3 row-start-1 flex flex-col items-end gap-1 lg:col-start-4">
                <button type="button" onClick={handleAddToCart} disabled={cartDisabled} aria-label={isBlockchain ? `View purchase options for ${asset.title}` : `Add ${asset.title} to cart (${licenseType.toLowerCase()} licence)`} title={isBlockchain ? "View purchase options" : `Add to cart · ${licenseType.toLowerCase()} licence`} className={`relative z-10 flex size-10 items-center justify-center rounded-full text-[#30392b] hover:bg-[#f1f3eb] disabled:opacity-40 ${FOCUS}`}>
                    {addToCart.isPending ? <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ShoppingCart className="size-5" aria-hidden="true" />}
                </button>
            </div>
            {cartMessage && <p role="status" className="col-span-full text-right text-xs text-[#555e49]">{cartMessage}</p>}
        </article>
    );
}
