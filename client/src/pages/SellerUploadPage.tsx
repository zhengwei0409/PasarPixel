import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "../components/ui/tabs";
import { useAsset, useSubmitForReview } from "../hooks/useAsset";
import UploadReviewStep from "../components/marketplace/UploadReviewStep";
import UploadDetailsStep from "../components/marketplace/UploadDetailsStep";
import UploadSpecificationsStep from "../components/marketplace/UploadSpecificationsStep";
import UploadPricingStep from "../components/marketplace/UploadPricingStep";
import { getErrorMessage } from "../lib/errors";

type TabValue = "details" | "specifications" | "pricing" | "submit";

export default function SellerUploadPage() {
    const params = useParams<{ assetId?: string }>();
    const navigate = useNavigate();
    const urlAssetId = params.assetId ? parseInt(params.assetId) : null;

    const {
        data: asset,
        isLoading: assetLoading,
        error: assetError,
    } = useAsset(urlAssetId);
    const {
        mutate: submit,
        isPending: isSubmitting,
        error: submitError,
    } = useSubmitForReview();

    const [tab, setTab] = useState<TabValue>("details");
    const [draftSaved, setDraftSaved] = useState(false);

    if (urlAssetId && assetLoading) {
        return <p className="p-8">Loading draft...</p>;
    }

    if (urlAssetId && (assetError || !asset)) {
        return (
            <div className="p-8 max-w-2xl mx-auto space-y-4">
                <p className="text-red-500">
                    {assetError
                        ? getErrorMessage(assetError)
                        : "Draft not found."}
                </p>
                <Link to="/seller/listings" className="text-blue-600 underline">
                    Back to My Listings
                </Link>
            </div>
        );
    }

    if (urlAssetId && asset && asset.status !== "DRAFT") {
        return (
            <div className="p-8 max-w-2xl mx-auto space-y-4">
                <p className="text-red-500">
                    This asset is no longer a draft (current status:{" "}
                    {asset.status}) and cannot be edited.
                </p>
                <Link to="/seller/listings" className="text-blue-600 underline">
                    Back to My Listings
                </Link>
            </div>
        );
    }

    const hasAsset = !!urlAssetId && !!asset;

    return (
        <div className="seller-upload-theme min-h-screen bg-background px-4 py-8 text-foreground sm:px-8 sm:py-12">
            <div className="max-w-[880px] mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="mb-2 text-[10px] font-medium tracking-[0.2em] text-[#74796c]">
                            YOUR NEXT CREATIVE RELEASE
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight">
                            {urlAssetId ? "Edit your asset" : "Upload an asset"}
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Give your creation a home in the marketplace.
                        </p>
                    </div>
                </div>

                <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
                    <TabsList className="grid w-full grid-cols-2 gap-1 group-data-horizontal/tabs:h-auto sm:grid-cols-4">
                        <TabsTrigger value="details" className="flex-1">
                            1. Details & files
                        </TabsTrigger>
                        <TabsTrigger
                            value="specifications"
                            disabled={!hasAsset}
                            className="flex-1"
                        >
                            2. Specifications
                        </TabsTrigger>
                        <TabsTrigger
                            value="pricing"
                            disabled={!hasAsset}
                            className="flex-1"
                        >
                            3. Pricing
                        </TabsTrigger>
                        <TabsTrigger
                            value="submit"
                            disabled={!hasAsset}
                            className="flex-1"
                        >
                            Preview
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="details">
                        <section className="pt-6">
                            <div className="mb-8 space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                                        Step 1 of 3: Asset details
                                    </h2>
                                    <span className="text-xs text-muted-foreground">
                                        33% complete
                                    </span>
                                </div>
                                <div
                                    role="progressbar"
                                    aria-label="Upload steps"
                                    aria-valuenow={1}
                                    aria-valuemin={0}
                                    aria-valuemax={3}
                                    className="h-1.5 overflow-hidden rounded-full bg-[#e7e9e1]"
                                >
                                    <div className="h-full w-1/3 rounded-full bg-[#657152]" />
                                </div>
                            </div>
                            {draftSaved && (
                                <p
                                    role="status"
                                    className="mb-6 rounded-xl border border-[#d4dbc9] bg-[#e3e8d8] p-3 text-sm text-[#555e49]"
                                >
                                    Draft saved. You can return to it from My
                                    Listings.
                                </p>
                            )}
                            <UploadDetailsStep
                                key={asset?.id ?? "new"}
                                asset={asset}
                                onSaved={(assetId, next) => {
                                    setDraftSaved(!next);
                                    if (!urlAssetId)
                                        navigate(`/seller/upload/${assetId}`, {
                                            replace: true,
                                        });
                                    if (next) setTab("specifications");
                                }}
                            />
                        </section>
                    </TabsContent>

                    <TabsContent
                        value="specifications"
                        forceMount
                        className="data-[state=inactive]:hidden"
                    >
                        {asset && (
                            <UploadSpecificationsStep
                                key={`${asset.id}-${asset.category}`}
                                asset={asset}
                                onBack={() => setTab("details")}
                                onNext={() => setTab("pricing")}
                            />
                        )}
                    </TabsContent>
                    <TabsContent
                        value="pricing"
                        forceMount
                        className="data-[state=inactive]:hidden"
                    >
                        {asset && (
                            <UploadPricingStep
                                key={asset.id}
                                asset={asset}
                                onBack={() => setTab("specifications")}
                                onNext={() => setTab("submit")}
                            />
                        )}
                    </TabsContent>

                    <TabsContent value="submit">
                        {asset && (
                            <UploadReviewStep
                                asset={asset}
                                onEdit={setTab}
                                isSubmitting={isSubmitting}
                                submitError={submitError}
                                onSubmit={() =>
                                    submit(asset.id, {
                                        onSuccess: () =>
                                            navigate("/seller/listings"),
                                    })
                                }
                            />
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
