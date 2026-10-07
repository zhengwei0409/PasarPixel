// Kept inside this service so its Docker image can load validation independently.
export const ORIENTATION_OPTIONS = [
    { value: "landscape", label: "Landscape" },
    { value: "portrait", label: "Portrait" },
    { value: "square", label: "Square" },
];
export const IMAGE_FORMATS = [
    { value: "jpeg", label: "JPG / JPEG" },
    { value: "png", label: "PNG" },
    { value: "webp", label: "WebP" },
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
