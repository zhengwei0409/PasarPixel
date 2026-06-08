import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";
import {
    useApproveAsset,
    usePendingReviewAssets,
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

export default function AdminAssetReviewPage() {
    const { data: assets, isLoading, error } = usePendingReviewAssets();
    const { mutate: approve, isPending: isApproving } = useApproveAsset();
    const {
        mutate: reject,
        isPending: isRejecting,
        error: rejectError,
    } = useRejectAsset();

    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [reason, setReason] = useState("");

    const closeDialog = () => {
        setRejectingId(null);
        setReason("");
    };

    const handleConfirmReject = () => {
        if (rejectingId == null || !reason.trim()) return;
        reject(
            { assetId: rejectingId, reason: reason.trim() },
            { onSuccess: () => closeDialog() },
        );
    };

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold">Pending Asset Reviews</h1>

                {isLoading && <p className="text-gray-600">Loading...</p>}
                {error && <p className="text-red-500">{getErrorMessage(error)}</p>}

                {assets && assets.length === 0 && (
                    <Card>
                        <CardContent className="py-12 text-center text-gray-600">
                            No assets are waiting for review.
                        </CardContent>
                    </Card>
                )}

                <div className="space-y-3">
                    {assets?.map((asset) => (
                        <Card key={asset.id}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg">
                                        <Link
                                            to={`/admin/assets/${asset.id}/review`}
                                            className="hover:underline"
                                        >
                                            {asset.title}
                                        </Link>
                                    </CardTitle>
                                    <span className="text-xs font-medium px-2 py-1 rounded bg-yellow-200 text-yellow-900">
                                        Pending Review
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="text-sm text-gray-600 flex flex-wrap gap-x-6 gap-y-1">
                                    <span>By: {asset.seller.name}</span>
                                    <span>{CATEGORY_LABELS[asset.category]}</span>
                                    <span>
                                        {asset.listingType === "BLOCKCHAIN"
                                            ? "Blockchain (NFT)"
                                            : "Traditional"}
                                    </span>
                                    <span>{asset._count.files} file(s)</span>
                                    <span>
                                        Submitted{" "}
                                        {new Date(asset.createdAt).toLocaleDateString()}
                                    </span>
                                    {asset.isAiGenerated && (
                                        <span className="text-purple-700">AI-generated</span>
                                    )}
                                </div>

                                {asset.description && (
                                    <p className="text-sm text-gray-700">
                                        {asset.description}
                                    </p>
                                )}

                                <div className="flex gap-2 pt-1">
                                    <Button
                                        size="sm"
                                        disabled={isApproving}
                                        onClick={() => approve(asset.id)}
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setRejectingId(asset.id)}
                                    >
                                        Reject
                                    </Button>
                                    <Button size="sm" variant="ghost" asChild>
                                        <Link to={`/admin/assets/${asset.id}/review`}>
                                            View details
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            <Dialog
                open={rejectingId != null}
                onOpenChange={(open) => {
                    if (!open) closeDialog();
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject asset</DialogTitle>
                        <DialogDescription>
                            Tell the seller why their asset is being rejected. They will see
                            this reason on their listings page.
                        </DialogDescription>
                    </DialogHeader>

                    <Textarea
                        rows={4}
                        placeholder="e.g. File quality is too low, please re-upload at a higher resolution."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                    />

                    {rejectError && (
                        <p className="text-sm text-red-500">
                            {getErrorMessage(rejectError)}
                        </p>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={isRejecting || !reason.trim()}
                            onClick={handleConfirmReject}
                        >
                            {isRejecting ? "Rejecting..." : "Confirm Reject"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
