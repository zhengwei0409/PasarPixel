import { assetFileError } from "../../lib/assetSpecifications";
import { useEffect, useRef, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import {
    ArrowLeft,
    Check,
    FileArchive,
    Loader2,
    Pencil,
    Send,
} from "lucide-react";
import { useReuseGlbPreview, useUpdateAsset } from "../../hooks/useAsset";
import {
    FORMAT_OPTIONS,
    ORIENTATION_OPTIONS,
    specificationsError,
} from "../../lib/assetSpecifications";
import { getErrorMessage } from "../../lib/errors";
import type { AssetFile, AssetWithFiles } from "../../types/asset";
import { Button } from "../ui/button";
import AssetUploader from "./AssetUploader";
import ModelViewer from "./ModelViewer";

const categories = {
    IMAGE: "Image",
    VIDEO: "Video",
    SOUND_EFFECT: "Audio",
    THREE_D_MODEL: "3D model",
    ANIMATION: "Animation",
    FONT: "Font",
};
function fileName(file: AssetFile) {
    const name = file.fileUrl.split("?")[0].split("/").pop() || "Uploaded file";
    try {
        return decodeURIComponent(name);
    } catch {
        return name;
    }
}
function size(bytes: number) {
    return bytes < 1024 * 1024
        ? `${(bytes / 1024).toFixed(1)} KB`
        : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
// Originals remain private: only public preview files and generated previews are displayed.
function publicPreview(file: AssetFile) {
    return file.purpose === "PREVIEW" ? file.fileUrl : file.previewUrl;
}

export default function UploadReviewStep({
    asset,
    onEdit,
    onSubmit,
    isSubmitting,
    submitError,
}: {
    asset: AssetWithFiles;
    onEdit: (step: "details" | "specifications" | "pricing") => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    submitError: unknown;
}) {
    const update = useUpdateAsset();
    const reuse = useReuseGlbPreview();
    const { mutate: preparePreview } = reuse;
    const attempted = useRef(new Set<number>());
    const sourceGlb =
        asset.category === "THREE_D_MODEL"
            ? asset.files.find(
                  (file) =>
                      file.purpose === "ORIGINAL" &&
                      /\.glb(\?|$)/i.test(file.fileUrl),
              )
            : undefined;
    const hasSeparateGlb = asset.files.some(
        (file) =>
            file.purpose === "PREVIEW" && /\.glb(\?|$)/i.test(file.fileUrl),
    );
    useEffect(() => {
        if (
            sourceGlb &&
            !sourceGlb.previewUrl &&
            !hasSeparateGlb &&
            !attempted.current.has(sourceGlb.id)
        ) {
            attempted.current.add(sourceGlb.id);
            preparePreview({ assetId: asset.id, fileId: sourceGlb.id });
        }
    }, [asset.id, sourceGlb, hasSeparateGlb, preparePreview]);
    const mutations = useIsMutating();
    const busy = isSubmitting || mutations > 0;
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState("");
    const originals = asset.files.filter((file) => file.purpose === "ORIGINAL");
    const images = [...asset.files]
        .sort(
            (a, b) =>
                Number(b.purpose === "PREVIEW") -
                Number(a.purpose === "PREVIEW"),
        )
        .filter(
            (file) =>
                file.purpose === "ORIGINAL" &&
                publicPreview(file) &&
                (file.fileType.startsWith("image/") ||
                    /\.(png|jpe?g|webp|avif)(\?|$)/i.test(
                        publicPreview(file)!,
                    )),
        );
    const media = asset.files.filter(
        (file) =>
            publicPreview(file) &&
            (file.fileType.startsWith("video/") ||
                file.fileType.startsWith("audio/") ||
                /\.glb(\?|$)/i.test(file.fileUrl)),
    );
    const specs = asset.technicalSpecifications;
    const missing: string[] = [];
    const invalidFile = asset.files.map(file => assetFileError(asset.category, file.fileUrl, file.fileType, file.purpose)).find(Boolean);
    if (invalidFile) missing.push(`${invalidFile} Remove it in Step 1.`);
    if (!asset.title.trim()) missing.push("Add an asset title in Step 1.");
    if (!originals.length)
        missing.push("Upload at least one source file in Step 1.");
    if (specificationsError(asset.category, specs))
        missing.push("Complete the technical specifications in Step 2.");
    if (asset.category === "SOUND_EFFECT" && !asset.audioType)
        missing.push("Choose Music or Sound effect in Step 2.");
    if (
        ["THREE_D_MODEL", "VIDEO", "ANIMATION"].includes(asset.category) &&
        !asset.files.some(
            (file) =>
                file.purpose === "PREVIEW" &&
                file.fileType.startsWith("image/"),
        )
    )
        missing.push("Upload a cover image below.");
    if (
        asset.category === "THREE_D_MODEL" &&
        !asset.files.some(
            (file) =>
                /\.glb(\?|$)/i.test(file.fileUrl) && !!publicPreview(file),
        )
    )
        missing.push(
            sourceGlb
                ? "Preparing the preview from your Step 1 GLB. If preparation fails, retry below."
                : "Your source files are not GLB. Upload a .glb below for the interactive 3D preview.",
        );
    if (asset.category === "ANIMATION") {
        if (
            !originals.some(
                (file) =>
                    /\.(glb|fbx|blend)(\?|$)/i.test(file.fileUrl),
            )
        )
            missing.push("Upload the animated 3D source file.");
        if (!asset.files.some((file) => file.purpose === "PREVIEW" && /\.mp4(\?|$)/i.test(file.fileUrl)))
            missing.push("Upload an MP4 preview below.");
    }
    if (asset.listingType === "BLOCKCHAIN")
        missing.push(
            "Blockchain setup is on hold. Choose Traditional in Step 3 to submit.",
        );
    else if (asset.pricePersonal == null && asset.priceCommercial == null)
        missing.push("Set at least one license price in Step 3.");
    const price = (value: string | null) =>
        value == null
            ? "Unavailable"
            : Number(value) === 0
              ? "Free"
              : new Intl.NumberFormat("en", {
                    style: "currency",
                    currency: asset.currency,
                }).format(Number(value));
    const edit = (step: "details" | "specifications" | "pricing") => (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onEdit(step)}
        >
            <Pencil className="size-3.5" />
            Edit
        </Button>
    );
    const save = async () => {
        setSaveError("");
        setSaved(false);
        try {
            await update.mutateAsync({ assetId: asset.id, payload: {} });
            setSaved(true);
        } catch (err) {
            setSaveError(getErrorMessage(err));
        }
    };
    return (
        <section className="space-y-8 pt-6" aria-labelledby="review-heading">
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="mb-2 text-xs font-medium tracking-wider text-[#74796c]">
                            FINAL REVIEW
                        </p>
                        <h2
                            id="review-heading"
                            className="text-2xl font-semibold tracking-tight sm:text-3xl"
                        >
                            Preview & review
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Check your listing and add the previews buyers will
                            see.
                        </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#e3e8d8] px-3 py-1 text-xs font-medium text-[#555e49]">
                        Final check
                    </span>
                </div>
                <div className="grid grid-cols-3 gap-1" aria-hidden="true">
                    {[1, 2, 3].map((step) => (
                        <div
                            key={step}
                            className="h-1.5 rounded-full bg-[#657152]"
                        />
                    ))}
                </div>
            </div>
            {reuse.isError && sourceGlb && !sourceGlb.previewUrl && (
                <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                    <p>{getErrorMessage(reuse.error)}</p>
                    <Button
                        variant="secondary"
                        className="mt-3"
                        disabled={busy}
                        onClick={() =>
                            preparePreview({
                                assetId: asset.id,
                                fileId: sourceGlb.id,
                            })
                        }
                    >
                        Retry GLB preview
                    </Button>
                </div>
            )}
            <div className="space-y-5">
                {asset.category === "IMAGE" && (
                    <div className="space-y-4">
                        <h3 className="font-semibold">Thumbnail</h3>
                        {images.length ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {images.map((file, index) => (
                                    <figure
                                        key={file.id}
                                        className="overflow-hidden rounded-xl border border-[#dfe4d6] bg-white"
                                    >
                                        <img
                                            src={publicPreview(file)!}
                                            alt={`${asset.title} — ${index === 0 ? "thumbnail" : `preview ${index + 1}`}`}
                                            className="aspect-square w-full object-cover"
                                        />
                                        <figcaption className="truncate p-3 text-xs text-muted-foreground">
                                            {index === 0
                                                ? "Thumbnail · "
                                                : "Preview · "}
                                            {fileName(file)}
                                        </figcaption>
                                    </figure>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                {originals.some((file) =>
                                    file.fileType.startsWith("image/"),
                                )
                                    ? "The uploaded image preview is not available yet."
                                    : "Upload your image in Step 1 to display its thumbnail."}
                            </p>
                        )}
                    </div>
                )}
                {["THREE_D_MODEL", "VIDEO", "ANIMATION"].includes(
                    asset.category,
                ) && (
                    <div inert={busy} className="space-y-4">
                        <h3 className="font-semibold">Thumbnail</h3>
                        <AssetUploader
                            assetId={asset.id}
                            category={asset.category}
                            review
                            section="cover"
                        />
                    </div>
                )}
                {media.map((file) => (
                    <div
                        key={file.id}
                        className="overflow-hidden rounded-xl border border-[#dfe4d6] bg-white p-4"
                    >
                        <p className="mb-3 truncate text-sm font-medium">
                            {fileName(file)}
                        </p>
                        {file.fileType.startsWith("video/") ? (
                            <video
                                controls
                                preload="metadata"
                                src={publicPreview(file)!}
                                className="max-h-80 w-full rounded-lg"
                            />
                        ) : file.fileType.startsWith("audio/") ? (
                            <audio
                                controls
                                preload="metadata"
                                src={publicPreview(file)!}
                                className="w-full"
                            />
                        ) : (
                            <div className="h-72">
                                <ModelViewer
                                    src={publicPreview(file)!}
                                    alt={asset.title}
                                />
                            </div>
                        )}
                    </div>
                ))}
                {["THREE_D_MODEL", "ANIMATION"].includes(asset.category) && (
                    <div
                        inert={busy}
                        className="rounded-2xl border border-[#dfe4d6] bg-white p-5 sm:p-6"
                    >
                        <AssetUploader
                            assetId={asset.id}
                            category={asset.category}
                            review
                            section="media"
                        />
                    </div>
                )}
            </div>
            <div className="space-y-6 rounded-2xl border border-[#dfe4d6] bg-white p-5 sm:p-7">
                <h3 className="text-lg font-semibold">Final review summary</h3>
                <div className="grid gap-6 sm:grid-cols-2">
                    <div className="min-w-0">
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <h4 className="text-xs font-medium tracking-wider text-[#74796c]">
                                ASSET DETAILS
                            </h4>
                            {edit("details")}
                        </div>
                        <p className="break-words font-semibold">
                            {asset.title}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                            {asset.description || "No description provided."}
                        </p>
                        <dl className="mt-4 space-y-2 text-sm">
                            <div>
                                <dt className="inline text-muted-foreground">
                                    Category:{" "}
                                </dt>
                                <dd className="inline">
                                    {categories[asset.category]}
                                </dd>
                            </div>
                            {asset.audioType && (
                                <div>
                                    <dt className="inline text-muted-foreground">
                                        Audio type:{" "}
                                    </dt>
                                    <dd className="inline">
                                        {asset.audioType === "MUSIC"
                                            ? "Music"
                                            : "Sound effect"}
                                    </dd>
                                </div>
                            )}
                            <div>
                                <dt className="inline text-muted-foreground">
                                    AI generated:{" "}
                                </dt>
                                <dd className="inline">
                                    {asset.isAiGenerated ? "Yes" : "No"}
                                </dd>
                            </div>
                        </dl>
                    </div>
                    <div>
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <h4 className="text-xs font-medium tracking-wider text-[#74796c]">
                                TECHNICAL SPECIFICATIONS
                            </h4>
                            {edit("specifications")}
                        </div>
                        <dl className="space-y-2 text-sm">
                            <div>
                                <dt className="text-muted-foreground">
                                    Format
                                </dt>
                                <dd className="mt-1 font-medium">
                                    {specs?.formats
                                        ?.map(
                                            (format) =>
                                                FORMAT_OPTIONS[
                                                    asset.category
                                                ].find(
                                                    (option) =>
                                                        option.value === format,
                                                )?.label ?? format,
                                        )
                                        .join(", ") || "Not specified"}
                                </dd>
                            </div>
                            {specs?.orientation && (
                                <div>
                                    <dt className="inline text-muted-foreground">
                                        Orientation:{" "}
                                    </dt>
                                    <dd className="inline">
                                        {ORIENTATION_OPTIONS.find(
                                            (option) =>
                                                option.value ===
                                                specs.orientation,
                                        )?.label ?? specs.orientation}
                                    </dd>
                                </div>
                            )}
                            {specs?.width && specs.height && (
                                <div>
                                    <dt className="inline text-muted-foreground">
                                        Dimensions:{" "}
                                    </dt>
                                    <dd className="inline">
                                        {specs.width} × {specs.height} px
                                    </dd>
                                </div>
                            )}
                            {specs?.durationSeconds != null && (
                                <div>
                                    <dt className="inline text-muted-foreground">
                                        Duration:{" "}
                                    </dt>
                                    <dd className="inline">
                                        {specs.durationSeconds} seconds
                                    </dd>
                                </div>
                            )}
                            {specs?.frameRate != null && (
                                <div>
                                    <dt className="inline text-muted-foreground">
                                        Frame rate:{" "}
                                    </dt>
                                    <dd className="inline">
                                        {specs.frameRate} fps
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </div>
                </div>
                <div className="border-t border-[#e1e5d9] pt-5">
                    <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-xs font-medium tracking-wider text-[#74796c]">
                            LICENSE & PRICING
                        </h4>
                        {edit("pricing")}
                    </div>
                    <p className="mb-3 text-sm font-medium">
                        {asset.listingType === "TRADITIONAL"
                            ? "Traditional license"
                            : "Blockchain license"}
                    </p>
                    {asset.listingType === "TRADITIONAL" ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {[
                                ["Personal license", asset.pricePersonal],
                                ["Commercial license", asset.priceCommercial],
                            ].map(([label, value]) => (
                                <div
                                    key={label}
                                    className="rounded-xl bg-[#f7f7f2] p-4"
                                >
                                    <p className="text-sm text-muted-foreground">
                                        {label}
                                    </p>
                                    <p className="mt-1 font-semibold">
                                        {price(value)}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {asset.currency}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Blockchain setup is on hold.
                            {asset.priceSol != null &&
                                ` Previously saved price: ${asset.priceSol} SOL.`}
                        </p>
                    )}
                </div>
                <div className="border-t border-[#e1e5d9] pt-5">
                    <h4 className="mb-3 text-xs font-medium tracking-wider text-[#74796c]">
                        FILES INCLUDED · {originals.length} SOURCE FILES
                    </h4>
                    <ul className="grid gap-3 sm:grid-cols-2">
                        {asset.files.map((file) => (
                            <li
                                key={file.id}
                                className="flex min-w-0 items-center gap-3 rounded-xl bg-[#f7f7f2] p-3"
                            >
                                <FileArchive className="size-5 shrink-0 text-[#657152]" />
                                <div className="min-w-0">
                                    <p
                                        className="truncate text-sm font-medium"
                                        title={fileName(file)}
                                    >
                                        {fileName(file)}
                                    </p>
                                    <p className="break-all text-xs text-muted-foreground">
                                        {size(file.fileSize)} ·{" "}
                                        {file.purpose === "ORIGINAL"
                                            ? "Source file"
                                            : "Public preview"}{" "}
                                        · {file.fileType}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            {missing.length > 0 && (
                <div className="rounded-xl border border-[#d4dbc9] bg-[#edf0e5] p-4">
                    <p className="mb-2 text-sm font-semibold">
                        Before you submit
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {missing.map((message) => (
                            <li key={message}>{message}</li>
                        ))}
                    </ul>
                </div>
            )}
            <p className="text-sm text-muted-foreground">
                Once submitted, an admin will review your asset. You won’t be
                able to edit it during review.
            </p>
            {(submitError != null || saveError) && (
                <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                    {saveError || getErrorMessage(submitError)}
                </p>
            )}
            {saved && (
                <p role="status" className="text-sm text-[#555e49]">
                    Draft saved. You can return to it from My Listings.
                </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e1e5d9] pt-6">
                <Button
                    variant="ghost"
                    className="h-11 px-3"
                    disabled={busy}
                    onClick={() => onEdit("pricing")}
                >
                    <ArrowLeft className="size-4" />
                    Back
                </Button>
                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="secondary"
                        className="h-11 px-5"
                        disabled={busy}
                        onClick={() => void save()}
                    >
                        <Check className="size-4" />
                        Save draft
                    </Button>
                    <Button
                        className="h-11 px-6"
                        disabled={busy || missing.length > 0}
                        onClick={onSubmit}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Send className="size-4" />
                                Submit for review
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </section>
    );
}
