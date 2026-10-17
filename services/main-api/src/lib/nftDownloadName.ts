import { extname } from "node:path";

// Private download presentation only; never changes the immutable file bytes,
// manifest or NFT metadata. Older snapshots may not contain a filename.
const EXTENSIONS: Record<string, string[]> = {
    "image/jpeg": ["jpg", "jpeg", "jpe"], "image/png": ["png"], "image/webp": ["webp"],
    "image/gif": ["gif"], "image/avif": ["avif"], "image/svg+xml": ["svg"],
    "video/mp4": ["mp4"], "video/quicktime": ["mov"], "video/webm": ["webm"], "video/x-msvideo": ["avi"],
    "audio/mpeg": ["mp3"], "audio/mp3": ["mp3"], "audio/wav": ["wav"], "audio/x-wav": ["wav"],
    "audio/flac": ["flac"], "audio/x-flac": ["flac"], "audio/ogg": ["ogg"], "audio/aac": ["aac"],
    "audio/mp4": ["m4a"], "font/ttf": ["ttf"], "font/otf": ["otf"], "font/woff": ["woff"], "font/woff2": ["woff2"],
    "application/x-font-ttf": ["ttf"], "application/x-font-opentype": ["otf"], "application/font-woff": ["woff"],
    "model/gltf-binary": ["glb"], "model/gltf+json": ["gltf"], "model/obj": ["obj"],
    "application/zip": ["zip"], "application/x-zip-compressed": ["zip"], "application/pdf": ["pdf"],
};

export function nftDownloadName(file: { name?: string; fileType?: string }, index: number, legacyName?: string): string {
    let candidate = file.name || legacyName || `original-${index + 1}`;
    try { candidate = decodeURIComponent(candidate); } catch { /* Keep literal percent characters. */ }
    candidate = candidate.split(/[/\\]/).pop()!.replace(/[\x00-\x1f\x7f:*?"<>|]/g, "_").trim();
    // Upload keys are <13-digit timestamp>-<original filename>.
    candidate = candidate.replace(/^\d{13}-/, "");
    if (!candidate || /^\.+$/.test(candidate)) candidate = `original-${index + 1}`;
    const extension = extname(candidate);
    const allowed = EXTENSIONS[(file.fileType || "").split(";")[0].trim().toLowerCase()];
    const suffix = allowed && !allowed.includes(extension.slice(1).toLowerCase())
        ? `.${allowed[0]}` : extension || ".bin";
    const stem = Array.from(extension ? candidate.slice(0, -extension.length) : candidate);
    while (Buffer.byteLength(stem.join(""), "utf8") > 200) stem.pop();
    return `${stem.join("") || `original-${index + 1}`}${suffix}`;
}
