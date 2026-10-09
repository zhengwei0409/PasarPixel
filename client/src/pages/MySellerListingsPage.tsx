import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    useCancelSubmission,
    useDeleteAsset,
    useMyAssets,
    useReopenRejected,
    useUpdateAsset,
} from "../hooks/useAsset";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { ArrowUpRight, Box, CalendarDays, FileText, Film, ImageIcon, Layers, Music2, Pencil, Sparkles, Type } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";
import { getErrorMessage } from "../lib/errors";
import type { Asset, AssetCategory, AssetStatus } from "../types/asset";

const CATEGORY_LABELS: Record<AssetCategory, string> = {
    THREE_D_MODEL: "3D Model",
    IMAGE: "Image",
    VIDEO: "Video",
    SOUND_EFFECT: "Audio",
    FONT: "Font",
    ANIMATION: "Animation",
};

const CATEGORY_ICONS = {
    THREE_D_MODEL: Box,
    IMAGE: ImageIcon,
    VIDEO: Film,
    SOUND_EFFECT: Music2,
    FONT: Type,
    ANIMATION: Sparkles,
};

const STATUS_STYLES: Record<AssetStatus, string> = {
    DRAFT: "border-[#dfe4d6] bg-[#eceee7] text-[#555e49]",
    PENDING_REVIEW: "border-amber-200 bg-amber-50 text-amber-800",
    PUBLISHED: "border-[#c5cfb5] bg-[#e3e8d8] text-[#465638]",
    REJECTED: "border-red-200 bg-red-50 text-red-800",
    TAKEN_DOWN: "border-stone-200 bg-stone-100 text-stone-600",
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

    const descriptionUpdate = useUpdateAsset();
    const [editingAsset, setEditingAsset] = useState<Pick<Asset, "id" | "title" | "description"> | null>(null);
    const [description, setDescription] = useState("");
    const [savedMessage, setSavedMessage] = useState<string | null>(null);

    const openDescriptionEditor = (asset: Asset) => {
        descriptionUpdate.reset();
        setSavedMessage(null);
        setEditingAsset(asset);
        setDescription(asset.description ?? "");
    };
    const closeDescriptionEditor = () => {
        if (descriptionUpdate.isPending) return;
        setEditingAsset(null);
        descriptionUpdate.reset();
    };
    const saveDescription = () => {
        if (!editingAsset || descriptionUpdate.isPending) return;
        descriptionUpdate.mutate({ assetId: editingAsset.id, payload: { description: description.trim() } }, {
            onSuccess: () => {
                setSavedMessage(`Description updated for “${editingAsset.title}”.`);
                setEditingAsset(null);
            },
        });
    };

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
        <main className="seller-listings-theme min-h-[calc(100dvh-73px)] bg-background text-foreground">
            <header className="relative overflow-hidden border-b border-border px-4 py-10 sm:px-8 sm:py-14">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,#e3e8d8_0%,transparent_70%)]" />
                <div className="relative mx-auto flex max-w-[1008px] flex-col justify-between gap-6 sm:flex-row sm:items-center">
                    <div>
                        <p className="mb-3 text-[10px] font-medium tracking-[0.22em] text-[#74796c]">YOUR CREATIVE STOREFRONT</p>
                        <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">My Listings</h1>
                    </div>

                </div>
            </header>

            <div className="mx-auto max-w-[1072px] space-y-8 px-4 py-8 sm:px-8 sm:py-10">
                {savedMessage && <p role="status" className="rounded-xl border border-[#c5cfb5] bg-[#e3e8d8] p-4 text-sm text-[#465638]">{savedMessage}</p>}
                {isLoading && (
                    <div role="status" className="space-y-4">
                        <p className="text-sm text-muted-foreground">Loading your listings…</p>
                        {[0, 1, 2].map((placeholder) => (
                            <div key={placeholder} aria-hidden="true" className="h-36 animate-pulse rounded-2xl border border-border bg-white motion-reduce:animate-none" />
                        ))}
                    </div>
                )}
                {error && (
                    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{getErrorMessage(error)}</p>
                )}

                {assets && !isLoading && !error && (
                    <>
                        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                            {[
                                { label: "Total listings", value: assets.length },
                                { label: "Published", value: assets.filter((asset) => asset.status === "PUBLISHED").length },
                                { label: "Pending review", value: assets.filter((asset) => asset.status === "PENDING_REVIEW").length },
                                { label: "Drafts", value: assets.filter((asset) => asset.status === "DRAFT").length },
                            ].map(({ label, value }) => (
                                <div key={label} className="rounded-xl border border-border bg-white/80 p-4 sm:p-5">
                                    <dt className="text-xs text-muted-foreground">{label}</dt>
                                    <dd className="mt-2 text-2xl font-semibold tracking-tight text-[#465638]">{value}</dd>
                                </div>
                            ))}
                        </dl>

                        <section aria-labelledby="listings-heading" className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <h2 id="listings-heading" className="text-lg font-semibold tracking-tight">Your assets</h2>
                                <span className="text-xs text-muted-foreground">{assets.length} {assets.length === 1 ? "listing" : "listings"}</span>
                            </div>
                            {assets.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-[#c5cfb5] bg-white/70 px-6 py-14 text-center">
                                    <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-secondary text-[#657152]"><Layers aria-hidden="true" className="size-6" /></div>
                                    <h3 className="text-lg font-medium">Your next creation belongs here</h3>
                                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">You haven't uploaded any assets yet. Start your collection with your first listing.</p>
                                    <Button asChild className="mt-6"><Link to="/seller/upload">Upload your first asset<ArrowUpRight aria-hidden="true" className="size-4" /></Link></Button>
                                </div>
                            )}
                            <div className="space-y-4">
                                {assets.map((asset) => {
                                    const CategoryIcon = CATEGORY_ICONS[asset.category];
                                    return (
                                        <article key={asset.id} className="rounded-2xl border border-border bg-white p-5 shadow-[0_8px_24px_-20px_rgba(37,40,35,0.2)] sm:p-6">
                                            <div className="flex items-start gap-4">
                                                <div aria-hidden="true" className="hidden size-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-[#657152] sm:flex"><CategoryIcon className="size-6" /></div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <h3 className="min-w-0 break-words text-base font-semibold tracking-tight sm:text-lg">{asset.title}</h3>
                                                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLES[asset.status]}`}>
                                                            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{STATUS_LABELS[asset.status]}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                                                        <span className="inline-flex items-center gap-1.5"><CategoryIcon aria-hidden="true" className="size-3.5" />{CATEGORY_LABELS[asset.category]}</span>
                                                        <span>{asset.listingType === "BLOCKCHAIN" ? "Blockchain (NFT)" : "Traditional"}</span>
                                                        <span className="inline-flex items-center gap-1.5"><FileText aria-hidden="true" className="size-3.5" />{asset._count.files} {asset._count.files === 1 ? "file" : "files"}</span>
                                                        <span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="size-3.5" />Created {new Date(asset.createdAt).toLocaleDateString()}</span>
                                                        {asset.isAiGenerated && <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-[#657152]"><Sparkles aria-hidden="true" className="size-3" />AI-generated</span>}
                                                    </div>
                                                    {asset.status === "REJECTED" && asset.rejectionReason && (
                                                        <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm leading-6 text-red-800"><span className="font-medium">Rejection reason:</span> {asset.rejectionReason}</p>
                                                    )}
                                                    {asset.status !== "TAKEN_DOWN" && (
                                                        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                                                            {asset.status === "REJECTED" && (
                                                                <Button size="sm" onClick={() => handleReopen(asset.id)} disabled={isReopening}>Edit &amp; Re-submit<ArrowUpRight aria-hidden="true" className="size-3.5" /></Button>
                                                            )}
                                                            {asset.status === "DRAFT" && (
                                                                <>
                                                                    <Button asChild size="sm"><Link to={`/seller/upload/${asset.id}`}>Continue Draft<ArrowUpRight aria-hidden="true" className="size-3.5" /></Link></Button>
                                                                    <Button size="sm" variant="outline" onClick={() => setPending({ kind: "delete-draft", assetId: asset.id })}>Delete Draft</Button>
                                                                </>
                                                            )}
                                                            {asset.status === "PENDING_REVIEW" && (
                                                                <Button size="sm" variant="outline" onClick={() => setPending({ kind: "cancel-submission", assetId: asset.id })}>Cancel Submission</Button>
                                                            )}
                                                            {asset.status === "PUBLISHED" && (
                                                                <>
                                                                    <Button size="sm" variant="outline" onClick={() => openDescriptionEditor(asset)}><Pencil aria-hidden="true" className="size-3.5" />Edit description</Button>
                                                                    <Button size="sm" variant="outline" onClick={() => setPending({ kind: "take-down", assetId: asset.id })}>Take Down</Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    </>
                )}
            </div>

            <Dialog open={editingAsset !== null} onOpenChange={(open) => { if (!open) closeDescriptionEditor(); }}>
                <DialogContent className="seller-listings-theme sm:max-w-lg" showCloseButton={!descriptionUpdate.isPending}>
                    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); saveDescription(); }}>
                        <DialogHeader>
                            <DialogTitle>Edit description</DialogTitle>
                            <DialogDescription className="break-words">{editingAsset?.title}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                            <label htmlFor="listing-description" className="text-sm font-medium">Description</label>
                            <Textarea id="listing-description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={descriptionUpdate.isPending} className="min-h-40 max-h-80 resize-y" aria-describedby="listing-description-help" />
                            <p id="listing-description-help" className="text-xs leading-5 text-muted-foreground">Your changes will appear on the listing once saved.</p>
                        </div>
                        {descriptionUpdate.error && <p role="alert" className="text-sm text-red-800">{getErrorMessage(descriptionUpdate.error)}</p>}
                        <DialogFooter>
                            <Button type="button" variant="outline" disabled={descriptionUpdate.isPending} onClick={closeDescriptionEditor}>Cancel</Button>
                            <Button type="submit" disabled={descriptionUpdate.isPending || description.trim() === (editingAsset?.description ?? "").trim()}>{descriptionUpdate.isPending ? "Saving…" : "Save changes"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={pending != null}
                onOpenChange={(open) => {
                    if (!open) closeDialog();
                }}
            >
                <DialogContent className="seller-listings-theme">
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
        </main>
    );
}
