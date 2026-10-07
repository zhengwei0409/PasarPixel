import { useQueryClient } from "@tanstack/react-query";
import { getAsset } from "../../services/assetService";
import { assetFileError, uploadAccept } from "../../lib/assetSpecifications";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
    ArrowRight,
    Check,
    CloudUpload,
    FileArchive,
    Loader2,
    X,
} from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { Progress } from "../ui/progress";
import {
    useCreateAsset,
    useDeleteAssetFile,
    useUpdateAsset,
    useUploadAssetFile,
} from "../../hooks/useAsset";
import { getErrorMessage } from "../../lib/errors";
import type {
    AssetCategory,
    AssetWithFiles,
    AudioType,
} from "../../types/asset";

const categories: { value: AssetCategory; label: string }[] = [
    { value: "THREE_D_MODEL", label: "3D Model" },
    { value: "IMAGE", label: "Image" },
    { value: "VIDEO", label: "Video" },
    { value: "SOUND_EFFECT", label: "Audio" },
    { value: "FONT", label: "Font" },
    { value: "ANIMATION", label: "Animation" },
];
const detailsSchema = z
    .object({
        title: z
            .string()
            .trim()
            .min(1, "Asset name is required")
            .max(120, "Use at most 120 characters"),
        category: z.enum(
            [
                "THREE_D_MODEL",
                "IMAGE",
                "VIDEO",
                "SOUND_EFFECT",
                "FONT",
                "ANIMATION",
            ],
            { required_error: "Choose a category" },
        ),
        description: z.string().max(2000, "Use at most 2,000 characters"),
        audioType: z.enum(["MUSIC", "SOUND_EFFECT"]).optional(),
        isAiGenerated: z.boolean(),
    })
    .superRefine((data, ctx) => {
        if (data.category === "SOUND_EFFECT" && !data.audioType) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Choose music or sound effect",
                path: ["audioType"],
            });
        }
    });
type Details = z.infer<typeof detailsSchema>;
const fieldClass =
    "h-12 data-[size=default]:h-12 w-full rounded-xl border-[#dfe4d6] bg-white px-4 shadow-none";

export default function UploadDetailsStep({
    asset,
    onSaved,
}: {
    asset?: AssetWithFiles;
    onSaved: (assetId: number, next: boolean) => void;
}) {
    const queryClient = useQueryClient();
    const create = useCreateAsset();
    const update = useUpdateAsset();
    const upload = useUploadAssetFile();
    const deleteFile = useDeleteAssetFile();
    const [savedId, setSavedId] = useState(asset?.id);
    const inputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [dragging, setDragging] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [progress, setProgress] = useState<{
        name: string;
        percent: number;
    } | null>(null);
    const {
        register,
        control,
        setValue,
        handleSubmit,
        formState: { errors },
    } = useForm<Details>({
        resolver: zodResolver(detailsSchema),
        defaultValues: {
            title: asset?.title ?? "",
            category: asset?.category,
            description: asset?.description ?? "",
            audioType: asset?.audioType ?? undefined,
            isAiGenerated: asset?.isAiGenerated ?? false,
        },
    });
    const category = useWatch({ control, name: "category" });
    const description = useWatch({ control, name: "description" });
    const audioType = useWatch({ control, name: "audioType" });
    const originals =
        asset?.files.filter((file) => file.purpose === "ORIGINAL") ?? [];

    const addFiles = (picked: File[]) => {
        setError("");
        if (!category) { setError("Choose a category before adding files."); return; }
        let total =
            (asset?.files ?? []).reduce((sum, file) => sum + file.fileSize, 0) +
            files.reduce((sum, file) => sum + file.size, 0);
        const accepted: File[] = [];
        for (const file of picked) {
            const formatError = assetFileError(category, file.name, file.type);
            if (formatError) { setError(formatError); continue; }
            if (
                files.some(
                    (existing) =>
                        existing.name === file.name &&
                        existing.size === file.size &&
                        existing.lastModified === file.lastModified,
                )
            )
                continue;
            if (file.size > 100 * 1024 * 1024) {
                setError(`“${file.name}” exceeds the 100 MB per-file limit.`);
                continue;
            }
            if (total + file.size > 500 * 1024 * 1024) {
                setError(
                    "These files would exceed the 500 MB total upload limit.",
                );
                continue;
            }
            total += file.size;
            accepted.push(file);
        }
        setFiles((previous) => [...previous, ...accepted]);
    };

    const save = async (data: Details, next: boolean) => {
        const invalidQueued = files.map(file => assetFileError(data.category, file.name, file.type)).find(Boolean);
        const invalidSaved = (asset?.files ?? []).map(file => assetFileError(data.category, file.fileUrl, file.fileType, file.purpose)).find(Boolean);
        if (invalidQueued || invalidSaved) {
            setError(`${invalidQueued || invalidSaved} Remove incompatible files before saving.`);
            return;
        }
        setBusy(true);
        setError("");
        try {
            const payload = {
                ...data,
                audioType:
                    data.category === "SOUND_EFFECT" ? data.audioType : null,
            };
            // Keep an existing draft's license/prices; new drafts defer pricing to later.
            const draft = savedId
                ? await update.mutateAsync({
                      assetId: savedId,
                      payload,
                  })
                : await create.mutateAsync({
                      ...payload,
                      listingType: "TRADITIONAL",
                      currency: "MYR",
                  });
            setSavedId(draft.id);
            for (const file of files) {
                setProgress({ name: file.name, percent: 0 });
                await upload.mutateAsync({
                    assetId: draft.id,
                    file,
                    purpose: "ORIGINAL",
                    onProgress: (percent) =>
                        setProgress({ name: file.name, percent }),
                });
                setFiles((previous) =>
                    previous.filter((queued) => queued !== file),
                );
            }
            // Await the complete draft, including newly registered source files,
            // before Step 2 initializes its format and metadata fields.
            await queryClient.fetchQuery({
                queryKey: ["asset", draft.id],
                queryFn: () => getAsset(draft.id),
                staleTime: 0,
            });
            setProgress(null);
            onSaved(draft.id, next);
        } catch (err) {
            setError(getErrorMessage(err));
            setProgress(null);
        } finally {
            setBusy(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit((data) => save(data, true))}
            className="space-y-8"
        >
            <fieldset disabled={busy} className="space-y-8 disabled:opacity-70">
                <div className="grid gap-6 sm:grid-cols-[2fr_1fr]">
                    <div className="space-y-2.5">
                        <Label htmlFor="asset-title">
                            Asset name <span className="text-[#7a8568]">*</span>
                        </Label>
                        <Input
                            id="asset-title"
                            {...register("title")}
                            maxLength={120}
                            placeholder="e.g. Cyberpunk Street Modular Kit"
                            className={fieldClass}
                            aria-invalid={!!errors.title}
                        />
                        {errors.title && (
                            <p
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {errors.title.message}
                            </p>
                        )}
                    </div>
                    <div className="space-y-2.5">
                        <Label htmlFor="asset-category">
                            Category <span className="text-[#7a8568]">*</span>
                        </Label>
                        <Select
                            disabled={busy}
                            value={category}
                            onValueChange={(value) =>
                                setValue("category", value as AssetCategory, {
                                    shouldValidate: true,
                                })
                            }
                        >
                            <SelectTrigger
                                id="asset-category"
                                className={fieldClass}
                                aria-invalid={!!errors.category}
                            >
                                <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(({ value, label }) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.category && (
                            <p
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {errors.category.message}
                            </p>
                        )}
                    </div>
                </div>
                {category === "SOUND_EFFECT" && (
                    <div className="max-w-sm space-y-2.5">
                        <Label htmlFor="asset-audio-type">
                            Audio type <span className="text-[#7a8568]">*</span>
                        </Label>
                        <Select
                            disabled={busy}
                            value={audioType ?? ""}
                            onValueChange={(value) =>
                                setValue("audioType", value as AudioType, {
                                    shouldValidate: true,
                                })
                            }
                        >
                            <SelectTrigger
                                id="asset-audio-type"
                                className={fieldClass}
                            >
                                <SelectValue placeholder="Choose audio type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="MUSIC">Music</SelectItem>
                                <SelectItem value="SOUND_EFFECT">
                                    Sound effect
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.audioType && (
                            <p
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {errors.audioType.message}
                            </p>
                        )}
                    </div>
                )}
                <div className="space-y-2.5">
                    <Label htmlFor="asset-description">
                        Description{" "}
                        <span className="font-normal text-muted-foreground">
                            (optional)
                        </span>
                    </Label>
                    <Textarea
                        id="asset-description"
                        {...register("description")}
                        maxLength={2000}
                        placeholder="Tell buyers what makes your asset useful. Include its features, intended use, and what’s included…"
                        className="min-h-40 resize-y rounded-xl border-[#dfe4d6] bg-white p-4 shadow-none"
                        aria-describedby="description-count"
                        aria-invalid={!!errors.description}
                    />
                    <p
                        id="description-count"
                        className="text-right text-xs text-muted-foreground"
                    >
                        {description.length.toLocaleString()} / 2,000 characters
                    </p>
                    {errors.description && (
                        <p role="alert" className="text-sm text-destructive">
                            {errors.description.message}
                        </p>
                    )}
                </div>
                <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-[#555e49]">
                    <input
                        type="checkbox"
                        {...register("isAiGenerated")}
                        className="size-4 accent-[#657152]"
                    />
                    This asset was created with AI
                </label>
                <section
                    aria-labelledby="source-files-heading"
                    className="space-y-3"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2
                            id="source-files-heading"
                            className="text-sm font-medium"
                        >
                            Upload source files
                        </h2>
                        <span className="text-xs text-muted-foreground">
                            100 MB per file · 500 MB total
                        </span>
                    </div>
                    <div
                        onDragOver={(event) => {
                            event.preventDefault();
                            if (!busy) setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(event) => {
                            event.preventDefault();
                            setDragging(false);
                            if (!busy)
                                addFiles(Array.from(event.dataTransfer.files));
                        }}
                        className={`flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${dragging ? "border-[#657152] bg-[#e3e8d8]" : "border-[#d4dbc9] bg-[#eef0e8]/60"}`}
                    >
                        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#e3e8d8] text-[#657152]">
                            <CloudUpload
                                className="size-6"
                                aria-hidden="true"
                            />
                        </div>
                        <p className="font-medium">
                            Drag and drop your source files
                        </p>
                        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                            Upload the original files buyers will download.
                            <br />
                            You’ll add thumbnails and previews later.
                            {category && <><br />Allowed: {uploadAccept(category).split(",").join(", ")}</>}
                        </p>
                        <Button
                            type="button"
                            variant="secondary"
                            className="mt-5 h-10 px-5"
                            onClick={() => inputRef.current?.click()}
                        >
                            Browse files
                        </Button>
                        <input
                            ref={inputRef}
                            type="file"
                            multiple
                            className="hidden"
                            aria-label="Upload source files"
                            accept={category ? uploadAccept(category) : undefined}
                            disabled={!category || busy}
                            onChange={(event) => {
                                addFiles(Array.from(event.target.files ?? []));
                                event.target.value = "";
                            }}
                        />
                    </div>
                    {files.length > 0 && (
                        <ul className="space-y-2">
                            {files.map((file, index) => (
                                <li
                                    key={`${file.name}-${index}`}
                                    className="flex items-center gap-3 rounded-xl border bg-white p-3"
                                >
                                    <FileArchive
                                        className="size-5 shrink-0 text-[#7a8568]"
                                        aria-hidden="true"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {(file.size / 1024 / 1024).toFixed(
                                                2,
                                            )}{" "}
                                            MB · Ready to upload
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={`Remove ${file.name}`}
                                        onClick={() =>
                                            setFiles((previous) =>
                                                previous.filter(
                                                    (_, position) =>
                                                        position !== index,
                                                ),
                                            )
                                        }
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </fieldset>
            {originals.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-medium">
                        Uploaded source files
                    </h3>
                    <ul className="space-y-2">
                        {originals.map((file) => (
                            <li
                                key={file.id}
                                className="flex items-center gap-3 rounded-xl border bg-white p-3"
                            >
                                <FileArchive
                                    className="size-5 shrink-0 text-[#7a8568]"
                                    aria-hidden="true"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                        {file.fileUrl.split("/").pop()}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {(file.fileSize / 1024 / 1024).toFixed(
                                            2,
                                        )}{" "}
                                        MB · Uploaded
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={busy || deleteFile.isPending}
                                    onClick={() =>
                                        deleteFile.mutate({
                                            assetId: file.assetId,
                                            fileId: file.id,
                                        })
                                    }
                                >
                                    Delete
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {deleteFile.error && (
                <p role="alert" className="text-sm text-destructive">
                    {getErrorMessage(deleteFile.error)}
                </p>
            )}
            {progress && (
                <div role="status" className="space-y-2">
                    <p className="truncate text-sm text-muted-foreground">
                        Uploading {progress.name} · {progress.percent}%
                    </p>
                    <Progress value={progress.percent} />
                </div>
            )}
            {error && (
                <p
                    role="alert"
                    className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
                >
                    {error}
                </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-6">
                {busy ? (
                    <span className="text-sm text-muted-foreground">
                        Saving your asset…
                    </span>
                ) : (
                    <Link
                        to="/seller/listings"
                        className="rounded-sm text-sm font-medium text-[#657152] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                        Cancel
                    </Link>
                )}
                <div className="flex gap-3">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        className="h-11 px-5"
                        onClick={handleSubmit((data) => save(data, false))}
                    >
                        <Check className="size-4" />
                        Save draft
                    </Button>
                    <Button type="submit" disabled={busy} className="h-11 px-6">
                        {busy ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Saving…
                            </>
                        ) : (
                            <>
                                Next step
                                <ArrowRight className="size-4" />
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </form>
    );
}
