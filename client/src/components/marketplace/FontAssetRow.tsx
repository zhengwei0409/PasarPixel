import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoaderCircle, ShoppingCart, Type } from "lucide-react";
import { useAddToCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { savePendingCartItem } from "@/lib/cartIntent";
import { shopDisplay } from "@/lib/store";
import { formatPrice, formatSol } from "@/lib/price";
import { useCurrencyStore } from "@/stores/currencyStore";
import type { BrowseAssetItem } from "@/types/asset";
import type { LicenseType } from "@/types/cart";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]";
const SAMPLE_TEXT = "The quick brown fox jumps over the lazy dog";

export default function FontAssetRow({ asset }: { asset: BrowseAssetItem }) {
    const fontFile = asset.files.find((file) => file.previewUrl && (
        file.fileType.includes("font") || /\.(ttf|otf|woff2?|eot)(?:[?#]|$)/i.test(file.fileUrl)
    ));
    // The generated PNG contains glyph outlines; the paid font file stays private.
    const previewUrl = fontFile?.previewUrl;
    const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);
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
        <article className="relative isolate col-span-full min-w-0 border-b border-[#e7e9e1] bg-white px-4 py-5 transition-colors hover:bg-[#fcfcfa] motion-reduce:transition-none sm:px-5 sm:py-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
                    <h3 className="min-w-0 truncate text-sm font-semibold text-[#252823]">
                        <Link to={`/assets/${asset.id}`} className={`after:absolute after:inset-0 after:content-[''] hover:underline ${FOCUS}`}>{asset.title}</Link>
                    </h3>
                    <span className="hidden text-[#c5cfb5] sm:block" aria-hidden="true">/</span>
                    <Link to={`/stores/${asset.seller.userId}`} className={`relative z-10 min-w-0 truncate text-xs text-[#73776e] hover:underline ${FOCUS}`}>By {shop.name}</Link>
                    <span className="text-xs font-medium text-[#555e49]">{priceLabel}</span>
                </div>
                <button type="button" onClick={handleAddToCart} disabled={cartDisabled} aria-label={isBlockchain ? `View purchase options for ${asset.title}` : `Add ${asset.title} to cart (${licenseType.toLowerCase()} licence)`} title={isBlockchain ? "View purchase options" : `Add to cart · ${licenseType.toLowerCase()} licence`} className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full text-[#30392b] hover:bg-[#f1f3eb] disabled:opacity-40 ${FOCUS}`}>
                    {addToCart.isPending ? <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ShoppingCart className="size-5" aria-hidden="true" />}
                </button>
            </div>
            <div className="mt-3 overflow-hidden rounded-sm bg-white">
                {previewUrl && failedPreviewUrl !== previewUrl ? (
                    // Match the sentence line at y=250 in the generated 1200×600
                    // specimen (fontPreview.ts), showing it without the other lines.
                    <svg viewBox="40 175 1120 125" role="img" aria-label={`${asset.title} font sample: ${SAMPLE_TEXT}`} className="h-20 w-full sm:h-24" preserveAspectRatio="xMinYMid slice">
                        <image href={previewUrl} width="1200" height="600" onError={() => setFailedPreviewUrl(previewUrl)} />
                    </svg>
                ) : (
                    <div className="flex min-h-20 items-center gap-3 text-sm text-[#85897f] sm:min-h-24">
                        <Type className="size-6 shrink-0" aria-hidden="true" />
                        <span>Font preview unavailable</span>
                    </div>
                )}
            </div>
            {cartMessage && <p role="status" className="mt-2 text-right text-xs text-[#555e49]">{cartMessage}</p>}
        </article>
    );
}
