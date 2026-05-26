import { useState } from "react";
import { Link } from "react-router-dom";
import { useMyAssets, useTakeDownAsset } from "../hooks/useAsset";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";
import { getErrorMessage } from "../lib/errors";
import type { AssetCategory, AssetStatus } from "../types/asset";

const CATEGORY_LABELS: Record<AssetCategory, string> = {
    THREE_D_MODEL: "3D Model",
    IMAGE: "Image",
    VIDEO: "Video",
    SOUND_EFFECT: "Sound Effect",
    FONT: "Font",
    ANIMATION: "Animation",
};

const STATUS_STYLES: Record<AssetStatus, string> = {
    DRAFT: "bg-gray-200 text-gray-800",
    PENDING_REVIEW: "bg-yellow-200 text-yellow-900",
    PUBLISHED: "bg-green-200 text-green-900",
    REJECTED: "bg-red-200 text-red-900",
    TAKEN_DOWN: "bg-zinc-300 text-zinc-700",
};

const STATUS_LABELS: Record<AssetStatus, string> = {
    DRAFT: "Draft",
    PENDING_REVIEW: "Pending Review",
    PUBLISHED: "Published",
    REJECTED: "Rejected",
    TAKEN_DOWN: "Taken Down",
};

export default function MySellerListingsPage() {
    const { data: assets, isLoading, error } = useMyAssets();
    const {
        mutate: takeDown,
        isPending: isTakingDown,
        error: takeDownError,
    } = useTakeDownAsset();
    const [takingDownId, setTakingDownId] = useState<number | null>(null);

    const closeDialog = () => setTakingDownId(null);

    const handleConfirmTakeDown = () => {
        if (takingDownId == null) return;
        takeDown(takingDownId, { onSuccess: () => closeDialog() });
    };

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">My Listings</h1>
                    <Link to="/seller/upload">
                        <Button>Upload New Asset</Button>
                    </Link>
                </div>

                {isLoading && <p className="text-gray-600">Loading...</p>}
                {error && (
                    <p className="text-red-500">{getErrorMessage(error)}</p>
                )}

                {assets && assets.length === 0 && (
                    <Card>
                        <CardContent className="py-12 text-center text-gray-600">
                            You haven't uploaded any assets yet.
                        </CardContent>
                    </Card>
                )}

                <div className="space-y-3">
                    {assets?.map((asset) => (
                        <Card key={asset.id}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg">
                                        {asset.title}
                                    </CardTitle>
                                    <span
                                        className={`text-xs font-medium px-2 py-1 rounded ${STATUS_STYLES[asset.status]}`}
                                    >
                                        {STATUS_LABELS[asset.status]}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="text-sm text-gray-600 flex flex-wrap gap-x-6 gap-y-1">
                                    <span>{CATEGORY_LABELS[asset.category]}</span>
                                    <span>
                                        {asset.listingType === "BLOCKCHAIN"
                                            ? "Blockchain (NFT)"
                                            : "Traditional"}
                                    </span>
                                    <span>{asset._count.files} file(s)</span>
                                    <span>
                                        Created{" "}
                                        {new Date(asset.createdAt).toLocaleDateString()}
                                    </span>
                                    {asset.isAiGenerated && (
                                        <span className="text-purple-700">AI-generated</span>
                                    )}
                                </div>
                                {asset.status === "REJECTED" && asset.rejectionReason && (
                                    <p className="text-sm text-red-700">
                                        <span className="font-medium">
                                            Rejection reason:
                                        </span>{" "}
                                        {asset.rejectionReason}
                                    </p>
                                )}
                                {asset.status !== "TAKEN_DOWN" && (
                                    <div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setTakingDownId(asset.id)}
                                        >
                                            Take Down
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            <Dialog
                open={takingDownId != null}
                onOpenChange={(open) => {
                    if (!open) closeDialog();
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Take down this asset?</DialogTitle>
                        <DialogDescription>
                            The asset will be hidden from the marketplace. You can keep this
                            entry for your records but it can't be republished.
                        </DialogDescription>
                    </DialogHeader>

                    {takeDownError && (
                        <p className="text-sm text-red-500">
                            {getErrorMessage(takeDownError)}
                        </p>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={isTakingDown}
                            onClick={handleConfirmTakeDown}
                        >
                            {isTakingDown ? "Taking down..." : "Confirm Take Down"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
