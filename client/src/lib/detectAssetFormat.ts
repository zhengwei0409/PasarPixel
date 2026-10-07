import type { AssetCategory, AssetFile } from "../types/asset";
import { FORMAT_OPTIONS } from "./assetSpecifications";

const MIME_FORMATS: Record<string, string> = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/avi": "avi",
    "video/x-msvideo": "avi",
    "video/msvideo": "avi",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/x-mp3": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/vnd.wave": "wav",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
    "audio/aac": "aac",
    "audio/x-aac": "aac",
    "audio/mp4": "aac",
    "audio/m4a": "aac",
    "audio/x-m4a": "aac",
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
    "audio/vorbis": "ogg",
    "font/ttf": "ttf",
    "application/x-font-ttf": "ttf",
    "application/x-font-truetype": "ttf",
    "font/otf": "otf",
    "application/x-font-otf": "otf",
    "application/x-font-opentype": "otf",
    "application/vnd.ms-opentype": "otf",
    "font/woff": "woff",
    "application/font-woff": "woff",
    "application/x-font-woff": "woff",
    "font/woff2": "woff2",
    "application/font-woff2": "woff2",
    "application/x-font-woff2": "woff2",
    "model/gltf-binary": "glb",
    "model/gltf+json": "gltf",
};

export function detectAssetFormats(
    category: AssetCategory,
    files: Pick<AssetFile, "fileUrl" | "fileType" | "purpose">[],
): string[] {
    const supported = FORMAT_OPTIONS[category].map((option) => option.value);
    const detected = new Set<string>();
    for (const file of files) {
        if (file.purpose !== "ORIGINAL") continue;
        let name = file.fileUrl.split(/[?#]/)[0].split("/").pop() ?? "";
        try {
            name = decodeURIComponent(name);
        } catch {
            /* Keep malformed URLs usable. */
        }
        const extension = name.includes(".")
            ? name.split(".").pop()?.toLowerCase()
            : undefined;
        const normalized =
            extension === "jpg"
                ? "jpeg"
                : extension === "m4a"
                  ? "aac"
                  : extension;
        const mimeFormat =
            MIME_FORMATS[file.fileType.split(";")[0].trim().toLowerCase()];
        const format =
            normalized && supported.includes(normalized)
                ? normalized
                : mimeFormat;
        if (format && supported.includes(format)) detected.add(format);
    }
    return [...detected];
}
