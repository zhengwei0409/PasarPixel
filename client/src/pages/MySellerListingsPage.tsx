import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    useCancelSubmission,
    useDeleteAsset,
    useMyAssets,
    useReopenRejected,
} from "../hooks/useAsset";
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

type PendingAction =
    | { kind: "delete-draft"; assetId: number }
    | { kind: "take-down"; assetId: number }
    | { kind: "cancel-submission"; assetId: number };

const ACTION_COPY: Record<
    PendingAction["kind"],
    { buttonLabel: string; title: string; description: string; confirmLabel: string; pendingLabel: string }
> = {
    "delete-draft": {
        buttonLabel: "Delete Draft",
        title: "Delete this draft?",
        description: "The draft and any uploaded files will be permanently removed. This cannot be undone.",
        confirmLabel: "Delete Draft",
        pendingLabel: "Deleting...",
    },
    "take-down": {
        buttonLabel: "Take Down",
        title: "Take down this asset?",
        description: "The asset will be hidden from the marketplace. You can keep this entry for your records but it can't be republished.",
        confirmLabel: "Confirm Take Down",
        pendingLabel: "Taking down...",
    },
    "cancel-submission": {
        buttonLabel: "Cancel Submission",
        title: "Cancel submission?",
        description: "The asset will return to draft so you can edit it and resubmit later.",
        confirmLabel: "Confirm Cancel",
        pendingLabel: "Cancelling...",
    },
};

export default function MySellerListingsPage() {
    const { data: assets, isLoading, error } = useMyAssets();
    const {
        mutate: deleteAsset,
        isPending: isDeleting,
        error: deleteError,
    } = useDeleteAsset();
    const {
        mutate: cancelSubmit,
        isPending: isCancelling,
        error: cancelError,
    } = useCancelSubmission();
    const { mutate: reopen, isPending: isReopening } = useReopenRejected();

    const navigate = useNavigate();

    const [pending, setPending] = useState<PendingAction | null>(null);

    const handleReopen = (assetId: number) => {
        reopen(assetId, {
            onSuccess: () => navigate(`/seller/upload/${assetId}`),
        });
    };

    const closeDialog = () => setPending(null);

    const handleConfirm = () => {
        if (!pending) return;
        if (pending.kind === "cancel-submission") {
            cancelSubmit(pending.assetId, { onSuccess: () => closeDialog() });
        } else {
            deleteAsset(pending.assetId, { onSuccess: () => closeDialog() });
        }
    };

    const isPending = isDeleting || isCancelling;
    const actionError = deleteError || cancelError;
    const copy = pending ? ACTION_COPY[pending.kind] : null;

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">My Listings</h1>
                    <div className="flex items-center gap-2">
                        <Link to="/seller/store">
                            <Button variant="outline">Store Settings</Button>
                        </Link>
                        <Link to="/seller/upload">
                            <Button>Upload New Asset</Button>
                        </Link>
                    </div>
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
                                {asset.status === "REJECTED" && (
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={() => handleReopen(asset.id)}
                                            disabled={isReopening}
                                        >
                                            Edit & Re-submit
                                        </Button>
                                    </div>
                                )}
                                {asset.status === "DRAFT" && (
                                    <div className="flex gap-2">
                                        <Button asChild size="sm">
                                            <Link to={`/seller/upload/${asset.id}`}>
                                                Continue Draft
                                            </Link>
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                setPending({
                                                    kind: "delete-draft",
                                                    assetId: asset.id,
                                                })
                                            }
                                        >
                                            Delete Draft
                                        </Button>
                                    </div>
                                )}
                                {asset.status === "PENDING_REVIEW" && (
                                    <div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                setPending({
                                                    kind: "cancel-submission",
                                                    assetId: asset.id,
                                                })
                                            }
                                        >
                                            Cancel Submission
                                        </Button>
                                    </div>
                                )}
                                {asset.status === "PUBLISHED" && (
                                    <div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                setPending({
                                                    kind: "take-down",
                                                    assetId: asset.id,
                                                })
                                            }
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
                open={pending != null}
                onOpenChange={(open) => {
                    if (!open) closeDialog();
                }}
            >
                <DialogContent>
                    {copy && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{copy.title}</DialogTitle>
                                <DialogDescription>{copy.description}</DialogDescription>
                            </DialogHeader>

                            {actionError && (
                                <p className="text-sm text-red-500">
                                    {getErrorMessage(actionError)}
                                </p>
                            )}

                            <DialogFooter>
                                <Button variant="outline" onClick={closeDialog}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    disabled={isPending}
                                    onClick={handleConfirm}
                                >
                                    {isPending ? copy.pendingLabel : copy.confirmLabel}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
