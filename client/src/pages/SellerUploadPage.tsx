import { useState } from "react";
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
import { useCreateAsset } from "../hooks/useAsset";
import AssetUploader from "../components/marketplace/AssetUploader";
import { getErrorMessage } from "../lib/errors";
import type { AssetCategory, ListingType } from "../types/asset";

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

const schema = z.object({
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
});

type FormData = z.infer<typeof schema>;

export default function SellerUploadPage() {
    const [assetId, setAssetId] = useState<number | null>(null);
    const { mutate: create, isPending, error } = useCreateAsset();

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { isAiGenerated: false },
    });

    const category = watch("category");
    const listingType = watch("listingType");

    const onSubmit = (data: FormData) => {
        create(
            {
                title: data.title,
                description: data.description || undefined,
                category: data.category,
                listingType: data.listingType,
                isAiGenerated: data.isAiGenerated,
            },
            {
                onSuccess: (asset) => setAssetId(asset.id),
            },
        );
    };

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold">Upload New Asset</h1>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {assetId ? "1. Asset Details ✓" : "1. Asset Details"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {assetId ? (
                            <p className="text-sm text-gray-600">
                                Draft created (id #{assetId}). You can now upload files below.
                            </p>
                        ) : (
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div className="space-y-1">
                                    <Label>Title</Label>
                                    <Input
                                        {...register("title")}
                                        placeholder="My awesome 3D dragon"
                                    />
                                    {errors.title && (
                                        <p className="text-sm text-red-500">
                                            {errors.title.message}
                                        </p>
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
                                        <p className="text-sm text-red-500">
                                            {errors.description.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <Label>Category</Label>
                                    <Select
                                        value={category}
                                        onValueChange={(v) =>
                                            setValue("category", v as AssetCategory, {
                                                shouldValidate: true,
                                            })
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
                                        <p className="text-sm text-red-500">
                                            {errors.category.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <Label>Listing Type</Label>
                                    <Select
                                        value={listingType}
                                        onValueChange={(v) =>
                                            setValue("listingType", v as ListingType, {
                                                shouldValidate: true,
                                            })
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
                                        <p className="text-sm text-red-500">
                                            {errors.listingType.message}
                                        </p>
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

                                {error && (
                                    <p className="text-sm text-red-500">
                                        {getErrorMessage(error)}
                                    </p>
                                )}

                                <Button type="submit" className="w-full" disabled={isPending}>
                                    {isPending ? "Creating..." : "Create Draft"}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>

                {assetId && (
                    <Card>
                        <CardHeader>
                            <CardTitle>2. Upload Files</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <AssetUploader assetId={assetId} />
                        </CardContent>
                    </Card>
                )}

                {assetId && (
                    <Card>
                        <CardHeader>
                            <CardTitle>3. Submit for Review</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm text-gray-600">
                                Once you've uploaded all files, submit the asset for admin
                                review. (Coming soon)
                            </p>
                            <Button disabled className="w-full">
                                Submit for Review
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
