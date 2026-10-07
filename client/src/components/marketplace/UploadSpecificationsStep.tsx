import { detectAssetFormats } from "../../lib/detectAssetFormat";
import { useState } from "react";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    FileArchive,
    Loader2,
    SlidersHorizontal,
} from "lucide-react";
import {
    FORMAT_OPTIONS,
    ORIENTATION_OPTIONS,
    specificationsError,
    type AssetSpecifications,
} from "../../lib/assetSpecifications";
import type { AssetWithFiles, AudioType } from "../../types/asset";
import { useUpdateAsset } from "../../hooks/useAsset";
import { getErrorMessage } from "../../lib/errors";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";

const labels = {
    IMAGE: "Image",
    VIDEO: "Video",
    THREE_D_MODEL: "3D model",
    ANIMATION: "Animation",
    FONT: "Font",
    SOUND_EFFECT: "Audio",
};
const fieldClass =
    "h-12 data-[size=default]:h-12 w-full rounded-xl border-[#dfe4d6] bg-white px-4 shadow-none";

export default function UploadSpecificationsStep({
    asset,
    onBack,
    onNext,
}: {
    asset: AssetWithFiles;
    onBack: () => void;
    onNext: () => void;
}) {
    const update = useUpdateAsset();
    const options = FORMAT_OPTIONS[asset.category];
    const originals = asset.files.filter((file) => file.purpose === "ORIGINAL");
    const detected = detectAssetFormats(asset.category, asset.files);
    const metadata = originals.find((file) =>
        asset.category === "IMAGE"
            ? file.fileType.startsWith("image/")
            : asset.category === "VIDEO"
              ? file.fileType.startsWith("video/")
              : file.fileType.startsWith("audio/"),
    );
    const initial = asset.technicalSpecifications;
    const [formatOverride, setFormatOverride] = useState<string | undefined>(
        initial?.formats?.find((value) =>
            options.some((option) => option.value === value),
        ),
    );
    const format = formatOverride ?? detected[0] ?? "";
    const [orientation, setOrientation] = useState(
        initial?.orientation ??
            (metadata?.width && metadata.height
                ? metadata.width === metadata.height
                    ? "square"
                    : metadata.width > metadata.height
                      ? "landscape"
                      : "portrait"
                : ""),
    );
    const [measurements, setMeasurements] = useState({
        width: String(initial?.width ?? metadata?.width ?? ""),
        height: String(initial?.height ?? metadata?.height ?? ""),
        durationSeconds: String(
            initial?.durationSeconds ?? metadata?.durationSeconds ?? "",
        ),
        frameRate: String(initial?.frameRate ?? metadata?.frameRate ?? ""),
    });
    const [audioType, setAudioType] = useState<AudioType | "">(
        asset.audioType ?? "",
    );
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const visual = asset.category === "IMAGE" || asset.category === "VIDEO";
    const timed =
        asset.category === "VIDEO" || asset.category === "SOUND_EFFECT";
    const dirty = () => {
        setSaved(false);
        setError("");
    };
    const measurement = (
        field: keyof typeof measurements,
        label: string,
        placeholder: string,
    ) => (
        <div className="space-y-2.5">
            <Label htmlFor={`spec-${field}`}>{label}</Label>
            <Input
                id={`spec-${field}`}
                type="number"
                min={field === "width" || field === "height" ? "1" : "0.001"}
                step={field === "width" || field === "height" ? "1" : "any"}
                placeholder={placeholder}
                value={measurements[field]}
                className={fieldClass}
                onChange={(event) => {
                    dirty();
                    setMeasurements((previous) => ({
                        ...previous,
                        [field]: event.target.value,
                    }));
                }}
            />
        </div>
    );

    const save = async (next: boolean) => {
        setError("");
        setSaved(false);
        const specifications: AssetSpecifications = {
            formats: format ? [format] : [],
            ...(visual && orientation ? { orientation } : {}),
        };
        for (const field of [
            ...(visual ? (["width", "height"] as const) : []),
            ...(timed ? (["durationSeconds"] as const) : []),
            ...(asset.category === "VIDEO" ? (["frameRate"] as const) : []),
        ]) {
            if (measurements[field] !== "")
                specifications[field] = Number(measurements[field]);
        }
        const validationError = specificationsError(
            asset.category,
            specifications,
        );
        if (validationError) {
            setError(validationError);
            return;
        }
        if (asset.category === "SOUND_EFFECT" && !audioType) {
            setError("Choose music or sound effect.");
            return;
        }
        try {
            await update.mutateAsync({
                assetId: asset.id,
                payload: {
                    technicalSpecifications: specifications,
                    ...(asset.category === "SOUND_EFFECT" && audioType
                        ? { audioType }
                        : {}),
                },
            });
            setSaved(true);
            if (next) onNext();
        } catch (err) {
            setError(getErrorMessage(err));
        }
    };

    return (
        <section className="pt-6" aria-labelledby="specifications-heading">
            <div className="mb-8 space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="mb-2 text-xs font-medium tracking-wider text-[#74796c]">
                            STEP 2 OF 3
                        </p>
                        <h2
                            id="specifications-heading"
                            className="text-2xl font-semibold tracking-tight sm:text-3xl"
                        >
                            Technical specifications
                        </h2>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                        67% complete
                    </span>
                </div>
                <div
                    role="progressbar"
                    aria-label="Upload steps"
                    aria-valuenow={2}
                    aria-valuemin={0}
                    aria-valuemax={3}
                    className="h-1.5 overflow-hidden rounded-full bg-[#e7e9e1]"
                >
                    <div className="h-full w-2/3 rounded-full bg-[#657152]" />
                </div>
            </div>
            <div className="mb-8 flex flex-wrap items-center gap-3">
                <span className="rounded-lg border border-[#d4dbc9] bg-[#e3e8d8] px-3 py-1.5 text-sm font-medium text-[#555e49]">
                    {labels[asset.category]}
                </span>
                <p className="text-sm text-muted-foreground">
                    Specify what’s included in your download.
                </p>
            </div>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    void save(true);
                }}
                className="space-y-8"
            >
                <fieldset
                    disabled={update.isPending}
                    className="space-y-8 disabled:opacity-70"
                >
                    <div className="space-y-4">
                        <h3 className="flex items-center gap-2 text-base font-semibold">
                            <SlidersHorizontal
                                className="size-4 text-[#657152]"
                                aria-hidden="true"
                            />
                            File format
                        </h3>
                        <p
                            id="format-help"
                            className="text-sm text-muted-foreground"
                        >
                            {detected.length > 1
                                ? "Multiple source formats detected. Choose the main format for this asset."
                                : detected.length === 1
                                  ? `Detected ${options.find((option) => option.value === detected[0])?.label} from your source file. You can change it below.`
                                  : "Choose the main file format. For ZIP bundles, select the format of the asset inside."}
                        </p>
                        <fieldset
                            aria-describedby="format-help"
                            className="flex flex-wrap gap-3"
                        >
                            <legend className="sr-only">
                                Download file format (required)
                            </legend>
                            {options.map((option) => (
                                <label
                                    key={option.value}
                                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-3 text-sm ${format === option.value ? "border-[#9cae87] bg-[#e3e8d8] font-medium text-[#30392b]" : "border-[#dfe4d6] bg-white text-[#73776e] hover:border-[#9cae87]"}`}
                                >
                                    <input
                                        type="radio"
                                        name="asset-file-format"
                                        value={option.value}
                                        className="size-4 accent-[#657152]"
                                        checked={format === option.value}
                                        onChange={() => {
                                            dirty();
                                            setFormatOverride(option.value);
                                        }}
                                    />
                                    {option.label}
                                </label>
                            ))}
                        </fieldset>
                    </div>
                    {(visual || timed) && (
                        <div className="space-y-5 border-t pt-6">
                            <div>
                                <h3 className="font-semibold">Attributes</h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Add specifications for your main source
                                    file. Measurements are optional.
                                </p>
                            </div>
                            <div className="grid gap-6 sm:grid-cols-2">
                                {asset.category === "SOUND_EFFECT" && (
                                    <div className="space-y-2.5">
                                        <Label htmlFor="spec-audio-type">
                                            Audio type
                                        </Label>
                                        <Select
                                            disabled={update.isPending}
                                            value={audioType}
                                            onValueChange={(value) => {
                                                dirty();
                                                setAudioType(
                                                    value as AudioType,
                                                );
                                            }}
                                        >
                                            <SelectTrigger
                                                id="spec-audio-type"
                                                className={fieldClass}
                                            >
                                                <SelectValue placeholder="Choose audio type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MUSIC">
                                                    Music
                                                </SelectItem>
                                                <SelectItem value="SOUND_EFFECT">
                                                    Sound effect
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                {visual && (
                                    <>
                                        <div className="space-y-2.5">
                                            <Label htmlFor="spec-orientation">
                                                Orientation
                                            </Label>
                                            <Select
                                                disabled={update.isPending}
                                                value={
                                                    orientation || "unspecified"
                                                }
                                                onValueChange={(value) => {
                                                    dirty();
                                                    setOrientation(
                                                        value === "unspecified"
                                                            ? ""
                                                            : value,
                                                    );
                                                }}
                                            >
                                                <SelectTrigger
                                                    id="spec-orientation"
                                                    className={fieldClass}
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unspecified">
                                                        Not specified
                                                    </SelectItem>
                                                    {ORIENTATION_OPTIONS.map(
                                                        (option) => (
                                                            <SelectItem
                                                                key={
                                                                    option.value
                                                                }
                                                                value={
                                                                    option.value
                                                                }
                                                            >
                                                                {option.label}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {measurement(
                                                "width",
                                                "Width (pixels)",
                                                "e.g. 1920",
                                            )}
                                            {measurement(
                                                "height",
                                                "Height (pixels)",
                                                "e.g. 1080",
                                            )}
                                        </div>
                                    </>
                                )}
                                {timed &&
                                    measurement(
                                        "durationSeconds",
                                        "Duration (seconds)",
                                        "e.g. 30",
                                    )}
                                {asset.category === "VIDEO" &&
                                    measurement(
                                        "frameRate",
                                        "Frame rate (fps)",
                                        "e.g. 24, 30, or 60",
                                    )}
                            </div>
                        </div>
                    )}
                    <div className="rounded-xl border bg-white p-4">
                        <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                            <FileArchive
                                className="size-4 text-[#7a8568]"
                                aria-hidden="true"
                            />
                            Source files from Step 1
                        </p>
                        {originals.length ? (
                            <ul className="space-y-1.5 text-sm text-muted-foreground">
                                {originals.map((file) => (
                                    <li key={file.id} className="truncate">
                                        {file.fileUrl.split("/").pop()}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No source files uploaded yet. Return to Step 1
                                to add them.
                            </p>
                        )}
                    </div>
                </fieldset>
                {error && (
                    <p
                        role="alert"
                        className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
                    >
                        {error}
                    </p>
                )}
                {saved && (
                    <p
                        role="status"
                        className="rounded-xl border border-[#d4dbc9] bg-[#e3e8d8] p-3 text-sm text-[#555e49]"
                    >
                        Technical specifications saved to your draft.
                    </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-6">
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={update.isPending}
                        className="h-11 px-3"
                        onClick={onBack}
                    >
                        <ArrowLeft className="size-4" />
                        Back
                    </Button>
                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={update.isPending}
                            className="h-11 px-5"
                            onClick={() => void save(false)}
                        >
                            <Check className="size-4" />
                            Save draft
                        </Button>
                        <Button
                            type="submit"
                            disabled={update.isPending}
                            className="h-11 px-6"
                        >
                            {update.isPending ? (
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
        </section>
    );
}
