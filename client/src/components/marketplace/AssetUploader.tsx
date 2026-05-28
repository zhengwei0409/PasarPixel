import { useRef, useState } from "react";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { useAsset, useDeleteAssetFile, useUploadAssetFile } from "../../hooks/useAsset";
import { getErrorMessage } from "../../lib/errors";

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

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetUploader({ assetId, category }: Props) {
    const { data: asset, isLoading } = useAsset(assetId);
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
                    onSuccess: () => {
                        setInFlight((prev) => prev.filter((u) => u.id !== id));
                    },
                    onError: (err) => {
                        setInFlight((prev) =>
                            prev.map((u) =>
                                u.id === id ? { ...u, error: getErrorMessage(err) } : u,
                            ),
                        );
                    },
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

    if (isLoading) return <p className="text-sm text-gray-500">Loading files...</p>;
    if (!asset) return <p className="text-sm text-red-500">Asset not found</p>;

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
                    Drag &amp; drop files here, or <span className="text-blue-600 underline">click to browse</span>
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

            {category === "ANIMATION" && (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                    <strong>Animation asset:</strong> Please upload both your <strong>3D file (.glb, .fbx, or .blend)</strong> and an <strong>MP4 preview video</strong>. Both are required before submission.
                </div>
            )}

            {category === "THREE_D_MODEL" && (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                    <strong>3D Model asset:</strong> A <strong>.glb file</strong> is required for the interactive 3D preview. You may also include other formats (.fbx, .blend, .obj, textures, etc.) as bundled downloads.
                </div>
            )}

            <div className="text-sm text-gray-600">
                Total: <span className="font-medium">{formatSize(projectedTotal)}</span> /{" "}
                {formatSize(MAX_TOTAL_SIZE)}
            </div>

            {(asset.files.length > 0 || inFlight.length > 0) && (
                <ul className="space-y-2">
                    {asset.files.map((f) => {
                        const name = f.fileUrl.split("/").pop() ?? "file";
                        return (
                            <li
                                key={f.id}
                                className="flex items-center justify-between border rounded p-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{name}</p>
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
                        );
                    })}

                    {inFlight.map((u) => (
                        <li key={u.id} className="border rounded p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="truncate text-sm font-medium">{u.file.name}</p>
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
