import { useRef, useState } from "react";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { useAsset, useDeleteAssetFile, useUploadAssetFile } from "../../hooks/useAsset";
import { getErrorMessage } from "../../lib/errors";
import type { AssetCategory, AssetFile, AssetFilePurpose } from "../../types/asset";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_TOTAL_SIZE = 500 * 1024 * 1024;

interface Props {
    assetId: number;
    category?: string;
}

interface InFlightUpload {
    id: string;
    file: File;
    progress: number;
    error?: string;
}

// A "slot" is one upload box with a specific role.
interface SlotDef {
    key: string;
    title: string;
    required: boolean;
    single: boolean; // single = preview-style slot: only one file, new replaces old
    // Returns true if a given file/filename belongs in this slot.
    match: (name: string, type: string) => boolean;
    accept: string; // value for <input accept="...">
    hint: string;
    // Whether files in this slot are the public PREVIEW or the private ORIGINAL.
    // The backend stores this so we can bucket files reliably and keep paid
    // originals out of the public previews/ prefix.
    purpose: AssetFilePurpose;
}

const matchExt = (name: string, exts: string[]) =>
    exts.some((e) => name.toLowerCase().endsWith(e));

// Optional cover image, shown first. Categories that have no static image of
// their own (3D, sound, video, animation) use this so the marketplace card has
// a thumbnail instead of "No preview".
const coverSlot: SlotDef = {
    key: "cover",
    title: "Cover Image — required",
    required: true,
    single: true,
    match: (_name, type) => type.startsWith("image/"),
    accept: "image/*",
    hint: "Shown as the thumbnail in the marketplace. One image.",
    purpose: "PREVIEW", // public — shown before purchase
};

// A catch-all optional slot for any remaining files (the download bundle).
const extraSlot = (hint: string): SlotDef => ({
    key: "extra",
    title: "Additional Files (optional)",
    required: false,
    single: false,
    match: () => true,
    accept: "",
    hint,
    purpose: "ORIGINAL", // private — part of the paid download
});

// Per-category slot layout. Categories not listed fall back to a single box.
const CATEGORY_SLOTS: Partial<Record<AssetCategory, SlotDef[]>> = {
    THREE_D_MODEL: [
        coverSlot,
        {
            key: "glb",
            title: "Preview File (.glb) — required",
            required: true,
            single: true,
            match: (name) => matchExt(name, [".glb"]),
            accept: ".glb",
            hint: "A low-poly .glb shown in the public interactive 3D preview. One file.",
            purpose: "PREVIEW", // public — the in-browser viewer
        },
        {
            key: "original",
            title: "Original Files — required",
            required: true,
            single: false,
            match: () => true,
            accept: "",
            hint: "The real files buyers download after paying (.fbx, .blend, .obj, high-poly .glb, textures, etc.).",
            purpose: "ORIGINAL", // private — only delivered after purchase
        },
    ],
    ANIMATION: [
        coverSlot,
        {
            key: "video",
            title: "MP4 Preview — required",
            required: true,
            single: true,
            match: (_name, type) => type.startsWith("video/"),
            accept: "video/mp4",
            hint: "A video preview buyers watch before purchase. One MP4.",
            purpose: "PREVIEW", // public — shown before purchase
        },
        {
            key: "model",
            title: "3D File (.glb / .fbx / .blend) — required",
            required: true,
            single: true,
            match: (name) => matchExt(name, [".glb", ".fbx", ".blend"]),
            accept: ".glb,.fbx,.blend",
            hint: "The animated 3D model buyers download. One file.",
            purpose: "ORIGINAL", // private — part of the paid download
        },
        extraSlot("Any other files to bundle in the download."),
    ],
    VIDEO: [coverSlot, extraSlot("Your video file, plus anything else to bundle.")],
    SOUND_EFFECT: [coverSlot, extraSlot("Your audio file, plus anything else to bundle.")],
};

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileNameOf(f: AssetFile): string {
    return f.fileUrl.split("/").pop() ?? "file";
}

// Decide which slot each already-uploaded file belongs to.
//
// The backend doesn't store which box a file was uploaded from, so we infer it
// from the file's type. Single-file slots (cover image, required preview, etc.)
// each claim only the FIRST file that matches them; the catch-all "extra" slot
// (optional + multi-file) collects everything left over. So a second matching
// file — e.g. a second image, or a second .blend dropped into "Additional
// Files" — lands in extras instead of being pulled into the single slot.
function bucketFiles(files: AssetFile[], slots: SlotDef[]): Record<string, AssetFile[]> {
    const buckets: Record<string, AssetFile[]> = {};
    for (const s of slots) buckets[s.key] = [];
    const claimed = new Set<string>(); // keys of single slots already filled

    for (const f of files) {
        const name = fileNameOf(f);
        // Only consider slots with the same purpose as the stored file, so a
        // public PREVIEW never lands in an ORIGINAL slot (or vice versa).
        const candidates = slots.filter((s) => s.purpose === f.purpose);
        const slot =
            candidates.find(
                (s) => s.single && !claimed.has(s.key) && s.match(name, f.fileType),
            ) ?? candidates.find((s) => !s.single); // catch-all: the multi-file slot
        if (slot) {
            buckets[slot.key].push(f);
            if (slot.single) claimed.add(slot.key);
        }
    }
    return buckets;
}

interface SlotProps {
    assetId: number;
    slot: SlotDef;
    files: AssetFile[];
    uploadedTotal: number; // bytes already uploaded across the whole asset
}

function UploadSlot({ assetId, slot, files, uploadedTotal }: SlotProps) {
    const upload = useUploadAssetFile();
    const del = useDeleteAssetFile();
    const [isDragging, setIsDragging] = useState(false);
    const [inFlight, setInFlight] = useState<InFlightUpload[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const doUpload = (file: File) => {
        const id = `${Date.now()}-${file.name}-${Math.random()}`;
        setInFlight((prev) => [...prev, { id, file, progress: 0 }]);
        upload.mutate(
            {
                assetId,
                file,
                purpose: slot.purpose,
                onProgress: (p) =>
                    setInFlight((prev) =>
                        prev.map((u) => (u.id === id ? { ...u, progress: p } : u)),
                    ),
            },
            {
                onSuccess: () => setInFlight((prev) => prev.filter((u) => u.id !== id)),
                onError: (err) =>
                    setInFlight((prev) =>
                        prev.map((u) =>
                            u.id === id ? { ...u, error: getErrorMessage(err) } : u,
                        ),
                    ),
            },
        );
    };

    const startUpload = (picked: FileList | File[]) => {
        const list = Array.from(picked);
        const inFlightTotal = inFlight.reduce((sum, u) => sum + u.file.size, 0);
        let runningTotal = uploadedTotal + inFlightTotal;

        for (const file of list) {
            if (file.size > MAX_FILE_SIZE) {
                alert(`"${file.name}" exceeds 100 MB limit`);
                continue;
            }
            if (runningTotal + file.size > MAX_TOTAL_SIZE) {
                alert(`Adding "${file.name}" would exceed 500 MB total`);
                continue;
            }
            runningTotal += file.size;
            // Type guard: reject files that don't belong in this slot.
            if (slot.required && !slot.match(file.name, file.type)) {
                alert(`"${file.name}" is not the right type for "${slot.title}"`);
                continue;
            }

            doUpload(file);
            if (slot.single) break; // single slot only ever takes one file

        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) startUpload(e.dataTransfer.files);
    };

    const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) startUpload(e.target.files);
        e.target.value = "";
    };

    const missing = slot.required && files.length === 0 && inFlight.length === 0;

    // A single slot only holds one file, so once something is uploaded (or
    // uploading) there's nothing more to add — hide the box until it's deleted.
    const hideBox = slot.single && (files.length > 0 || inFlight.length > 0);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{slot.title}</p>
                {missing && <span className="text-xs text-red-500">Missing</span>}
            </div>

            {!hideBox && (
            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragging
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                }`}
            >
                <p className="text-sm text-gray-600">
                    Drag &amp; drop, or{" "}
                    <span className="text-blue-600 underline">click to browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">{slot.hint}</p>
                <input
                    ref={inputRef}
                    type="file"
                    multiple={!slot.single}
                    accept={slot.accept || undefined}
                    className="hidden"
                    onChange={onFilePick}
                />
            </div>
            )}

            {(files.length > 0 || inFlight.length > 0) && (
                <ul className="space-y-2">
                    {files.map((f) => (
                        <li
                            key={f.id}
                            className="flex items-center justify-between border rounded p-3"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                    {fileNameOf(f)}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {formatSize(f.fileSize)} · {f.fileType}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => del.mutate({ assetId, fileId: f.id })}
                                disabled={del.isPending}
                            >
                                Delete
                            </Button>
                        </li>
                    ))}

                    {inFlight.map((u) => (
                        <li key={u.id} className="border rounded p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="truncate text-sm font-medium">
                                    {u.file.name}
                                </p>
                                <span className="text-xs text-gray-500">
                                    {u.error ? "Failed" : `${u.progress}%`}
                                </span>
                            </div>
                            {u.error ? (
                                <p className="text-xs text-red-500">{u.error}</p>
                            ) : (
                                <Progress value={u.progress} />
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// Fallback single-box uploader for categories without a slot layout.
function SingleBoxUploader({ assetId }: { assetId: number }) {
    const { data: asset } = useAsset(assetId);
    const upload = useUploadAssetFile();
    const del = useDeleteAssetFile();
    const [isDragging, setIsDragging] = useState(false);
    const [inFlight, setInFlight] = useState<InFlightUpload[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const uploadedTotal = (asset?.files ?? []).reduce((sum, f) => sum + f.fileSize, 0);
    const inFlightTotal = inFlight.reduce((sum, u) => sum + u.file.size, 0);
    const projectedTotal = uploadedTotal + inFlightTotal;

    const startUpload = (files: FileList | File[]) => {
        const list = Array.from(files);
        let runningTotal = projectedTotal;

        for (const file of list) {
            if (file.size > MAX_FILE_SIZE) {
                alert(`"${file.name}" exceeds 100 MB limit`);
                continue;
            }
            if (runningTotal + file.size > MAX_TOTAL_SIZE) {
                alert(`Adding "${file.name}" would exceed 500 MB total`);
                continue;
            }
            runningTotal += file.size;

            const id = `${Date.now()}-${file.name}-${Math.random()}`;
            setInFlight((prev) => [...prev, { id, file, progress: 0 }]);

            upload.mutate(
                {
                    assetId,
                    file,
                    onProgress: (p) =>
                        setInFlight((prev) =>
                            prev.map((u) => (u.id === id ? { ...u, progress: p } : u)),
                        ),
                },
                {
                    onSuccess: () =>
                        setInFlight((prev) => prev.filter((u) => u.id !== id)),
                    onError: (err) =>
                        setInFlight((prev) =>
                            prev.map((u) =>
                                u.id === id ? { ...u, error: getErrorMessage(err) } : u,
                            ),
                        ),
                },
            );
        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) startUpload(e.dataTransfer.files);
    };

    const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) startUpload(e.target.files);
        e.target.value = "";
    };

    return (
        <div className="space-y-4">
            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                    isDragging
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                }`}
            >
                <p className="text-gray-600">
                    Drag &amp; drop files here, or{" "}
                    <span className="text-blue-600 underline">click to browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Max 100 MB per file, 500 MB total</p>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={onFilePick}
                />
            </div>

            <div className="text-sm text-gray-600">
                Total: <span className="font-medium">{formatSize(projectedTotal)}</span> /{" "}
                {formatSize(MAX_TOTAL_SIZE)}
            </div>

            {((asset?.files.length ?? 0) > 0 || inFlight.length > 0) && (
                <ul className="space-y-2">
                    {(asset?.files ?? []).map((f) => (
                        <li
                            key={f.id}
                            className="flex items-center justify-between border rounded p-3"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                    {fileNameOf(f)}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {formatSize(f.fileSize)} · {f.fileType}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => del.mutate({ assetId, fileId: f.id })}
                                disabled={del.isPending}
                            >
                                Delete
                            </Button>
                        </li>
                    ))}

                    {inFlight.map((u) => (
                        <li key={u.id} className="border rounded p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="truncate text-sm font-medium">
                                    {u.file.name}
                                </p>
                                <span className="text-xs text-gray-500">
                                    {u.error ? "Failed" : `${u.progress}%`}
                                </span>
                            </div>
                            {u.error ? (
                                <p className="text-xs text-red-500">{u.error}</p>
                            ) : (
                                <Progress value={u.progress} />
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function AssetUploader({ assetId, category }: Props) {
    const { data: asset, isLoading } = useAsset(assetId);

    if (isLoading) return <p className="text-sm text-gray-500">Loading files...</p>;
    if (!asset) return <p className="text-sm text-red-500">Asset not found</p>;

    const slots = category ? CATEGORY_SLOTS[category as AssetCategory] : undefined;

    // Categories without a slot layout keep the original single-box behaviour.
    if (!slots) return <SingleBoxUploader assetId={assetId} />;

    const buckets = bucketFiles(asset.files, slots);
    const total = asset.files.reduce((sum, f) => sum + f.fileSize, 0);

    return (
        <div className="space-y-6">
            {slots.map((slot) => (
                <UploadSlot
                    key={slot.key}
                    assetId={assetId}
                    slot={slot}
                    files={buckets[slot.key]}
                    uploadedTotal={total}
                />
            ))}

            <div className="text-sm text-gray-600">
                Total: <span className="font-medium">{formatSize(total)}</span> /{" "}
                {formatSize(MAX_TOTAL_SIZE)}
            </div>
        </div>
    );
}
