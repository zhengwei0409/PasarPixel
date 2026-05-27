import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
    useAsset,
    useCreateAsset,
    useSubmitForReview,
    useUpdateAsset,
} from "../hooks/useAsset";
import AssetUploader from "../components/marketplace/AssetUploader";
import { getErrorMessage } from "../lib/errors";
import type { AssetCategory, Currency, ListingType } from "../types/asset";

const CATEGORY_OPTIONS: { value: AssetCategory; label: string }[] = [
    { value: "THREE_D_MODEL", label: "3D Model" },
    { value: "IMAGE", label: "Image" },
    { value: "VIDEO", label: "Video" },
    { value: "SOUND_EFFECT", label: "Sound Effect" },
    { value: "FONT", label: "Font" },
    { value: "ANIMATION", label: "Animation" },
];

const LISTING_TYPE_OPTIONS: { value: ListingType; label: string }[] = [
    { value: "TRADITIONAL", label: "Traditional License" },
    { value: "BLOCKCHAIN", label: "Blockchain (NFT)" },
];

const priceString = z
    .string()
    .optional()
    .refine(
        (v) => {
            if (v === undefined || v === "") return true;
            const n = parseFloat(v);
            return !isNaN(n) && n >= 0;
        },
        { message: "Price must be a non-negative number" },
    );

const schema = z
    .object({
        title: z.string().min(1, "Title is required").max(120, "Title too long"),
        description: z.string().max(2000).optional(),
        category: z.enum([
            "THREE_D_MODEL",
            "IMAGE",
            "VIDEO",
            "SOUND_EFFECT",
            "FONT",
            "ANIMATION",
        ]),
        listingType: z.enum(["TRADITIONAL", "BLOCKCHAIN"]),
        isAiGenerated: z.boolean().optional(),
        pricePersonal: priceString,
        priceCommercial: priceString,
        priceSol: priceString,
        currency: z.enum(["USD", "MYR"]),
    })
    .superRefine((data, ctx) => {
        if (data.listingType === "BLOCKCHAIN") {
            if (data.pricePersonal || data.priceCommercial) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Blockchain listings cannot set fiat prices",
                    path: ["pricePersonal"],
                });
            }
        } else {
            if (data.priceSol) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Traditional listings cannot set SOL price",
                    path: ["priceSol"],
                });
            }
        }
    });

function parsePriceOrNull(v: string | undefined): number | null {
    if (!v) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
}

type WizardForm = z.infer<typeof schema>;
type TabValue = "details" | "files" | "submit";

interface DetailsFormProps {
    initialValues?: Partial<WizardForm>;
    isEdit: boolean;
    isSaving: boolean;
    saveError: unknown;
    onSave: (data: WizardForm) => void;
}

function DetailsForm({ initialValues, isEdit, isSaving, saveError, onSave }: DetailsFormProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<WizardForm>({
        resolver: zodResolver(schema),
        defaultValues: {
            title: initialValues?.title ?? "",
            description: initialValues?.description ?? "",
            category: initialValues?.category,
            listingType: initialValues?.listingType,
            isAiGenerated: initialValues?.isAiGenerated ?? false,
            pricePersonal: initialValues?.pricePersonal ?? "",
            priceCommercial: initialValues?.priceCommercial ?? "",
            priceSol: initialValues?.priceSol ?? "",
            currency: initialValues?.currency ?? "USD",
        },
    });

    const category = watch("category");
    const listingType = watch("listingType");
    const currency = watch("currency");

    return (
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <div className="space-y-1">
                <Label>Title</Label>
                <Input {...register("title")} placeholder="My awesome 3D dragon" />
                {errors.title && (
                    <p className="text-sm text-red-500">{errors.title.message}</p>
                )}
            </div>

            <div className="space-y-1">
                <Label>Description (optional)</Label>
                <Textarea
                    {...register("description")}
                    rows={4}
                    placeholder="Describe your asset, intended use, etc."
                />
                {errors.description && (
                    <p className="text-sm text-red-500">{errors.description.message}</p>
                )}
            </div>

            <div className="space-y-1">
                <Label>Category</Label>
                <Select
                    value={category}
                    onValueChange={(v) =>
                        setValue("category", v as AssetCategory, { shouldValidate: true })
                    }
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                        {CATEGORY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {errors.category && (
                    <p className="text-sm text-red-500">{errors.category.message}</p>
                )}
            </div>

            <div className="space-y-1">
                <Label>Listing Type</Label>
                <Select
                    value={listingType}
                    onValueChange={(v) =>
                        setValue("listingType", v as ListingType, { shouldValidate: true })
                    }
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select listing type" />
                    </SelectTrigger>
                    <SelectContent>
                        {LISTING_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {errors.listingType && (
                    <p className="text-sm text-red-500">{errors.listingType.message}</p>
                )}
            </div>

            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    {...register("isAiGenerated")}
                    className="rounded"
                />
                This asset is AI-generated
            </label>

            <div className="space-y-3 rounded-md border p-4">
                <h3 className="font-medium">Pricing & Licenses</h3>

                {listingType === "BLOCKCHAIN" ? (
                    <div className="space-y-1">
                        <Label>Price (SOL)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...register("priceSol")}
                        />
                        {errors.priceSol && (
                            <p className="text-sm text-red-500">{errors.priceSol.message}</p>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>Personal License Price</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    {...register("pricePersonal")}
                                />
                                {errors.pricePersonal && (
                                    <p className="text-sm text-red-500">
                                        {errors.pricePersonal.message}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label>Commercial License Price</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    {...register("priceCommercial")}
                                />
                                {errors.priceCommercial && (
                                    <p className="text-sm text-red-500">
                                        {errors.priceCommercial.message}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Currency</Label>
                            <Select
                                value={currency}
                                onValueChange={(v) =>
                                    setValue("currency", v as Currency, { shouldValidate: true })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="MYR">MYR</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="text-xs text-gray-500">
                            Leave a tier blank to disable it. At least one tier must have a
                            price before submission.
                        </p>
                    </>
                )}
            </div>

            {saveError != null && (
                <p className="text-sm text-red-500">{getErrorMessage(saveError)}</p>
            )}

            <Button type="submit" className="w-full" disabled={isSaving}>
                {isSaving ? "Saving..." : isEdit ? "Save Changes" : "Create Draft"}
            </Button>
        </form>
    );
}

export default function SellerUploadPage() {
    const params = useParams<{ assetId?: string }>();
    const navigate = useNavigate();
    const urlAssetId = params.assetId ? parseInt(params.assetId) : null;

    const { data: asset, isLoading: assetLoading, error: assetError } = useAsset(urlAssetId);
    const { mutate: create, isPending: isCreating, error: createError } = useCreateAsset();
    const { mutate: update, isPending: isUpdating, error: updateError } = useUpdateAsset();
    const {
        mutate: submit,
        isPending: isSubmitting,
        error: submitError,
    } = useSubmitForReview();

    const [tab, setTab] = useState<TabValue>("details");

    if (urlAssetId && assetLoading) {
        return <p className="p-8">Loading draft...</p>;
    }

    if (urlAssetId && (assetError || !asset)) {
        return (
            <div className="p-8 max-w-2xl mx-auto space-y-4">
                <p className="text-red-500">
                    {assetError ? getErrorMessage(assetError) : "Draft not found."}
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
                    This asset is no longer a draft (current status: {asset.status}) and
                    cannot be edited.
                </p>
                <Link to="/seller/listings" className="text-blue-600 underline">
                    Back to My Listings
                </Link>
            </div>
        );
    }

    const onSaveDetails = (data: WizardForm) => {
        const isBlockchain = data.listingType === "BLOCKCHAIN";
        const pricingPayload = {
            pricePersonal: isBlockchain ? null : parsePriceOrNull(data.pricePersonal),
            priceCommercial: isBlockchain ? null : parsePriceOrNull(data.priceCommercial),
            priceSol: isBlockchain ? parsePriceOrNull(data.priceSol) : null,
            currency: data.currency,
        };

        if (urlAssetId) {
            update(
                {
                    assetId: urlAssetId,
                    payload: {
                        title: data.title,
                        description: data.description || undefined,
                        category: data.category,
                        listingType: data.listingType,
                        isAiGenerated: data.isAiGenerated,
                        ...pricingPayload,
                    },
                },
                { onSuccess: () => setTab("files") },
            );
        } else {
            create(
                {
                    title: data.title,
                    description: data.description || undefined,
                    category: data.category,
                    listingType: data.listingType,
                    isAiGenerated: data.isAiGenerated,
                    ...pricingPayload,
                },
                {
                    onSuccess: (newAsset) => {
                        navigate(`/seller/upload/${newAsset.id}`, { replace: true });
                        setTab("files");
                    },
                },
            );
        }
    };

    const hasAsset = !!urlAssetId && !!asset;
    const fileCount = asset?.files.length ?? 0;
    const detailsError = createError || updateError;
    const isSavingDetails = isCreating || isUpdating;

    const initialValues: Partial<WizardForm> | undefined = asset
        ? {
              title: asset.title,
              description: asset.description ?? "",
              category: asset.category,
              listingType: asset.listingType,
              isAiGenerated: asset.isAiGenerated,
              pricePersonal: asset.pricePersonal ?? "",
              priceCommercial: asset.priceCommercial ?? "",
              priceSol: asset.priceSol ?? "",
              currency: asset.currency ?? "USD",
          }
        : undefined;

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        {urlAssetId ? "Edit Draft" : "Upload New Asset"}
                    </h1>
                    <Link to="/seller/listings" className="text-sm text-blue-600 underline">
                        My Listings
                    </Link>
                </div>

                <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
                    <TabsList className="w-full">
                        <TabsTrigger value="details" className="flex-1">
                            1. Details
                        </TabsTrigger>
                        <TabsTrigger
                            value="files"
                            disabled={!hasAsset}
                            className="flex-1"
                        >
                            2. Files {hasAsset && `(${fileCount})`}
                        </TabsTrigger>
                        <TabsTrigger
                            value="submit"
                            disabled={!hasAsset}
                            className="flex-1"
                        >
                            3. Submit
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="details">
                        <Card>
                            <CardHeader>
                                <CardTitle>Asset Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <DetailsForm
                                    key={asset?.id ?? "new"}
                                    initialValues={initialValues}
                                    isEdit={!!urlAssetId}
                                    isSaving={isSavingDetails}
                                    saveError={detailsError}
                                    onSave={onSaveDetails}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="files">
                        <Card>
                            <CardHeader>
                                <CardTitle>Upload Files</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {hasAsset && <AssetUploader assetId={urlAssetId!} />}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="submit">
                        <Card>
                            <CardHeader>
                                <CardTitle>Submit for Review</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-gray-600">
                                    Once submitted, an admin will review your asset. You
                                    won't be able to edit it during review.
                                </p>
                                {submitError && (
                                    <p className="text-sm text-red-500">
                                        {getErrorMessage(submitError)}
                                    </p>
                                )}
                                <Button
                                    className="w-full"
                                    disabled={
                                        isSubmitting || !asset || asset.files.length === 0
                                    }
                                    onClick={() => urlAssetId && submit(urlAssetId)}
                                >
                                    {isSubmitting
                                        ? "Submitting..."
                                        : !asset || asset.files.length === 0
                                          ? "Upload at least one file first"
                                          : "Submit for Review"}
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

