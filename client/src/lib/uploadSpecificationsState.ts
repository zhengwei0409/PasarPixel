import { FORMAT_OPTIONS } from "./assetSpecifications";
import { detectAssetFormats } from "./detectAssetFormat";
import type { AssetWithFiles } from "../types/asset";

// Public preview updates must not reset edits to source specifications.
export function specificationSourceKey(asset: AssetWithFiles): string {
    return JSON.stringify([
        asset.id,
        asset.category,
        asset.files
            .filter(file => file.purpose === "ORIGINAL")
            .sort((a, b) => a.id - b.id)
            .map(file => [
                file.id, file.fileUrl, file.fileType, file.fileSize,
                file.width, file.height, file.durationSeconds, file.frameRate,
            ]),
    ]);
}

export function uploadSpecificationDefaults(
    asset: AssetWithFiles,
    useSavedSpecifications = true,
) {
    const detected = detectAssetFormats(asset.category, asset.files);
    const initial = useSavedSpecifications ? asset.technicalSpecifications : undefined;
    const savedFormat = initial?.formats?.find(value =>
        FORMAT_OPTIONS[asset.category].some(option => option.value === value)
        && (!detected.length || detected.includes(value)),
    );
    const family = asset.category === "IMAGE" ? "image/"
        : asset.category === "VIDEO" ? "video/"
        : asset.category === "SOUND_EFFECT" ? "audio/" : undefined;
    const metadata = family ? asset.files.find(file =>
        file.purpose === "ORIGINAL" && file.fileType.startsWith(family),
    ) : undefined;
    const orientation = metadata?.width && metadata.height
        ? metadata.width === metadata.height ? "square"
            : metadata.width > metadata.height ? "landscape" : "portrait"
        : "";
    return {
        format: savedFormat ?? detected[0] ?? "",
        orientation: initial?.orientation ?? orientation,
        measurements: {
            width: String(initial?.width ?? metadata?.width ?? ""),
            height: String(initial?.height ?? metadata?.height ?? ""),
            durationSeconds: String(initial?.durationSeconds ?? metadata?.durationSeconds ?? ""),
            frameRate: String(initial?.frameRate ?? metadata?.frameRate ?? ""),
        },
    };
}
