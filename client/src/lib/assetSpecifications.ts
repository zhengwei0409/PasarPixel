export const ORIENTATION_OPTIONS = [
    { value: "landscape", label: "Landscape" },
    { value: "portrait", label: "Portrait" },
    { value: "square", label: "Square" },
];
export const IMAGE_FORMATS = [
    { value: "jpeg", label: "JPG / JPEG" },
    { value: "png", label: "PNG" },
    { value: "webp", label: "WebP" },
    { value: "avif", label: "AVIF" },
    { value: "gif", label: "GIF" },
];
export const VIDEO_FORMATS = [
    { value: "mp4", label: "MP4" },
    { value: "mov", label: "MOV" },
    { value: "webm", label: "WebM" },
    { value: "avi", label: "AVI" },
];
export const ANIMATION_FORMATS = [
    { value: "glb", label: "GLB" },
    { value: "fbx", label: "FBX" },
    { value: "blend", label: "BLEND" },
];
export const MODEL_FORMATS = [
    { value: "glb", label: "GLB" },
    { value: "gltf", label: "GLTF" },
    { value: "fbx", label: "FBX" },
    { value: "obj", label: "OBJ" },
    { value: "blend", label: "BLEND" },
    { value: "stl", label: "STL" },
];
export const FONT_FORMATS = [
    { value: "ttf", label: "TTF" },
    { value: "otf", label: "OTF" },
    { value: "woff", label: "WOFF" },
    { value: "woff2", label: "WOFF2" },
];
export const AUDIO_FORMATS = [
    { value: "mp3", label: "MP3" },
    { value: "wav", label: "WAV" },
    { value: "flac", label: "FLAC" },
    { value: "aac", label: "AAC / M4A" },
    { value: "ogg", label: "OGG" },
];
export const FORMAT_OPTIONS = {
    IMAGE: IMAGE_FORMATS,
    VIDEO: VIDEO_FORMATS,
    ANIMATION: ANIMATION_FORMATS,
    THREE_D_MODEL: MODEL_FORMATS,
    FONT: FONT_FORMATS,
    SOUND_EFFECT: AUDIO_FORMATS,
};
export interface AssetSpecifications {
    formats: string[];
    orientation?: string;
    width?: number;
    height?: number;
    durationSeconds?: number;
    frameRate?: number;
}

export function specificationsError(
    category: keyof typeof FORMAT_OPTIONS,
    input: unknown,
): string | null {
    if (!input || typeof input !== "object" || Array.isArray(input))
        return "Technical specifications must be an object.";
    const values = input as Record<string, unknown>;
    const formats = FORMAT_OPTIONS[category].map((option) => option.value);
    if (
        !Array.isArray(values.formats) ||
        !values.formats.length ||
        values.formats.some(
            (format) => typeof format !== "string" || !formats.includes(format),
        )
    )
        return "Select at least one supported file format for this category.";
    const visual = category === "IMAGE" || category === "VIDEO";
    const timed = category === "VIDEO" || category === "SOUND_EFFECT";
    const fields = [
        "formats",
        ...(visual ? ["orientation", "width", "height"] : []),
        ...(timed ? ["durationSeconds"] : []),
        ...(category === "VIDEO" ? ["frameRate"] : []),
    ];
    if (Object.keys(values).some((field) => !fields.includes(field)))
        return "These specifications do not apply to the selected category.";
    if (
        values.orientation !== undefined &&
        !["landscape", "portrait", "square"].includes(
            String(values.orientation),
        )
    )
        return "Choose a valid orientation.";
    for (const [field, label] of [
        ["width", "Width"],
        ["height", "Height"],
        ["durationSeconds", "Duration"],
        ["frameRate", "Frame rate"],
    ]) {
        const value = values[field];
        if (
            value !== undefined &&
            (typeof value !== "number" ||
                !Number.isFinite(value) ||
                value <= 0 ||
                ((field === "width" || field === "height") &&
                    (!Number.isSafeInteger(value) || value > 2147483647)))
        )
            return `${label} must be a positive ${field === "width" || field === "height" ? "whole number" : "number"}.`;
    }
    if ((values.width === undefined) !== (values.height === undefined))
        return "Enter both width and height.";
    if (
        typeof values.width === "number" &&
        typeof values.height === "number" &&
        values.orientation
    ) {
        const orientation =
            values.width === values.height
                ? "square"
                : values.width > values.height
                  ? "landscape"
                  : "portrait";
        if (values.orientation !== orientation)
            return "Orientation must match the dimensions entered.";
    }
    return null;
}

// ZIP bundles supplement model/animation source files; they are not previews.
export function uploadAccept(
    category: keyof typeof FORMAT_OPTIONS,
    purpose: "ORIGINAL" | "PREVIEW" = "ORIGINAL",
): string {
    const formats = purpose === "PREVIEW"
        ? [...IMAGE_FORMATS.map(option => option.value),
            ...(category === "THREE_D_MODEL" ? ["glb"] : []),
            ...(category === "ANIMATION" ? ["mp4"] : [])]
        : [...FORMAT_OPTIONS[category].map(option => option.value),
            ...(["THREE_D_MODEL", "ANIMATION"].includes(category) ? ["zip"] : [])];
    return formats.flatMap(format => format === "jpeg" ? [".jpg", ".jpeg"]
        : format === "aac" ? [".aac", ".m4a"] : [`.${format}`]).join(",");
}

export function assetFileError(
    category: keyof typeof FORMAT_OPTIONS,
    name: string,
    mimeType: string,
    purpose: "ORIGINAL" | "PREVIEW" = "ORIGINAL",
): string | null {
    let filename = name.split(/[?#]/)[0].split("/").pop() ?? "";
    try { filename = decodeURIComponent(filename); } catch { /* Use the literal filename. */ }
    const extension = filename.match(/\.[^.]+$/)?.[0].toLowerCase();
    const allowed = uploadAccept(category, purpose).split(",");
    if (!extension || !allowed.includes(extension))
        return `“${filename}” is not supported for this category. Allowed: ${allowed.join(", ")}.`;
    const mime = mimeType.split(";")[0].trim().toLowerCase();
    // Empty/generic MIME is common for local model and font files. Require the
    // extension and reject explicit MIME families that contradict it.
    const image = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"].includes(extension);
    const video = [".mp4", ".mov", ".webm", ".avi"].includes(extension);
    const audio = [".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg"].includes(extension);
    const font = [".ttf", ".otf", ".woff", ".woff2"].includes(extension);
    const model = [".glb", ".gltf", ".fbx", ".obj", ".blend", ".stl"].includes(extension);
    if ((mime.startsWith("image/") && !image)
        || (mime.startsWith("video/") && !video)
        || (mime.startsWith("audio/") && !audio)
        || (mime.startsWith("font/") && !font)
        || (mime.startsWith("model/") && !model)
        || (["application/zip", "application/x-zip-compressed"].includes(mime) && extension !== ".zip")
        || (purpose === "PREVIEW" && extension === ".mp4" && mime.startsWith("video/") && mime !== "video/mp4"))
        return `“${filename}” has a file type that does not match its format.`;
    return null;
}
