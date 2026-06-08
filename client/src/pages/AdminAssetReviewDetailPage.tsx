import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
    useApproveAsset,
    useAssetForReview,
    useRejectAsset,
} from "../hooks/useAsset";
import { getErrorMessage } from "../lib/errors";
import type { AssetCategory } from "../types/asset";

const CATEGORY_LABELS: Record<AssetCategory, string> = {
    THREE_D_MODEL: "3D Model",
    IMAGE: "Image",
    VIDEO: "Video",
    SOUND_EFFECT: "Sound Effect",
    FONT: "Font",
    ANIMATION: "Animation",
};

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="font-medium">{value ?? "—"}</p>
        </div>
    );
}

export default function AdminAssetReviewDetailPage() {
    const { id } = useParams<{ id: string }>();
    const assetId = Number(id);
    const navigate = useNavigate();

    const { data: asset, isLoading, error } = useAssetForReview(assetId);
    const { mutate: approve, isPending: isApproving } = useApproveAsset();
    const { mutate: reject, isPending: isRejecting, error: rejectError } = useRejectAsset();

    const [showReject, setShowReject] = useState(false);
    const [reason, setReason] = useState("");

    if (isLoading) return <p className="p-8">Loading...</p>;
    if (error || !asset)
        return (
            <p className="p-8 text-red-500">
                {error ? getErrorMessage(error) : "Not found"}
            </p>
        );

    const handleApprove = () => {
        approve(assetId, { onSuccess: () => navigate("/admin/assets/pending") });
    };

    const handleReject = () => {
        if (!reason.trim()) return;
        reject(
            { assetId, reason: reason.trim() },
            { onSuccess: () => navigate("/admin/assets/pending") },
        );
    };

    return (
        <div className="max-w-3xl mx-auto p-8 space-y-6">
            <Link to="/admin/assets/pending" className="text-sm text-blue-600 underline">
                ← Back to pending reviews
            </Link>

            <div className="flex items-start justify-between">
                <h1 className="text-2xl font-bold">{asset.title}</h1>
                <span className="text-xs font-medium px-2 py-1 rounded bg-yellow-200 text-yellow-900">
                    {asset.status === "PENDING_REVIEW" ? "Pending Review" : asset.status}
                </span>
            </div>

            <div className="border rounded-lg p-6 grid grid-cols-2 gap-4">
                <Field label="Category" value={CATEGORY_LABELS[asset.category]} />
                <Field
                    label="Listing Type"
                    value={asset.listingType === "BLOCKCHAIN" ? "Blockchain (NFT)" : "Traditional"}
                />
                <Field
                    label="Personal Price"
                    value={asset.pricePersonal ? `${asset.currency} ${asset.pricePersonal}` : null}
                />
                <Field
                    label="Commercial Price"
                    value={asset.priceCommercial ? `${asset.currency} ${asset.priceCommercial}` : null}
                />
                <Field label="AI-generated" value={asset.isAiGenerated ? "Yes" : "No"} />
                <Field label="Submitted" value={new Date(asset.createdAt).toLocaleString()} />
                <div className="col-span-2">
                    <Field label="Description" value={asset.description} />
                </div>
            </div>

            <div className="border rounded-lg p-6 grid grid-cols-2 gap-4">
                <h2 className="col-span-2 font-semibold">Store / Seller</h2>
                <Field label="Store Name" value={asset.store?.storeName} />
                <Field label="Seller" value={asset.seller.name} />
                <Field label="Email" value={asset.seller.email} />
                <div className="col-span-2">
                    <Field label="Why they sell" value={asset.store?.reason} />
                </div>
                <div className="col-span-2">
                    <Field
                        label="Portfolio"
                        value={
                            asset.store?.portfolioLink ? (
                                <a
                                    href={asset.store.portfolioLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 underline"
                                >
                                    {asset.store.portfolioLink}
                                </a>
                            ) : null
                        }
                    />
                </div>
            </div>

            <div className="border rounded-lg p-6 space-y-3">
                <h2 className="font-semibold">Files ({asset.files.length})</h2>
                {asset.files.length === 0 ? (
                    <p className="text-sm text-gray-500">No files uploaded.</p>
                ) : (
                    <ul className="divide-y">
                        {asset.files.map((file) => (
                            <li
                                key={file.id}
                                className="flex items-center justify-between py-2 text-sm"
                            >
                                <div>
                                    <span className="font-medium">{file.fileType}</span>{" "}
                                    <span className="text-gray-500">
                                        · {file.purpose} · {formatSize(file.fileSize)}
                                    </span>
                                </div>
                                {/* Download wiring added in step 4 */}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="border rounded-lg p-6 space-y-3">
                {showReject ? (
                    <div className="space-y-2">
                        <Input
                            placeholder="Reason for rejection"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                        {rejectError && (
                            <p className="text-sm text-red-500">{getErrorMessage(rejectError)}</p>
                        )}
                        <div className="flex gap-2">
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleReject}
                                disabled={isRejecting || !reason.trim()}
                            >
                                Confirm Reject
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setShowReject(false);
                                    setReason("");
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleApprove} disabled={isApproving}>
                            Approve
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setShowReject(true)}>
                            Reject
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
