import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowDownToLine, ArrowLeft, ArrowUpRight, CalendarDays, Check, CircleCheck, Clock3, File, FolderOpen, LoaderCircle, Package, ShieldCheck, Store, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import ReasonPicker from "../components/ReasonPicker";
import { ASSET_REJECT_REASONS } from "../lib/adminReasons";
import { useApproveAsset, useAssetForReview, useAssetFileDownloadUrl, useRejectAsset, useTakeDownAdminAsset } from "../hooks/useAsset";
import { getErrorMessage } from "../lib/errors";
import { formatPrice, formatSol } from "../lib/price";
import type { AssetCategory, AssetStatus } from "../types/asset";

const CATEGORY_LABELS: Record<AssetCategory, string> = {
    THREE_D_MODEL: "3D model", IMAGE: "Image", VIDEO: "Video", SOUND_EFFECT: "Audio", FONT: "Font", ANIMATION: "Animation",
};
const STATUS_LABELS: Record<AssetStatus, string> = {
    DRAFT: "Draft", PENDING_REVIEW: "Pending review", PUBLISHED: "Published", REJECTED: "Rejected", TAKEN_DOWN: "Taken down",
};
const STATUS_STYLES: Record<AssetStatus, string> = {
    DRAFT: "bg-secondary text-secondary-foreground", PENDING_REVIEW: "bg-amber-50 text-amber-800", PUBLISHED: "bg-accent text-[#425137]", REJECTED: "bg-red-50 text-red-700", TAKEN_DOWN: "bg-red-50 text-red-700",
};

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
    return <div className="min-w-0"><dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</dt><dd className="mt-2 break-words text-sm leading-6 font-medium">{value ?? "—"}</dd></div>;
}

function SectionHeading({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
    return <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-[#657152]" aria-hidden="true">{icon}</span><div><h2 className="text-base font-semibold tracking-tight">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></div>;
}

function portfolioHref(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch { return null; }
}

export default function AdminAssetReviewDetailPage() {
    const { id } = useParams<{ id: string }>();
    const assetId = Number(id);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const fromAllAssets = searchParams.get("from") === "all";
    const backTo = fromAllAssets ? "/admin/assets" : "/admin/assets/pending";
    const { data: asset, isLoading, error, refetch, isFetching } = useAssetForReview(assetId);
    const { mutate: approve, isPending: isApproving, error: approveError } = useApproveAsset();
    const { mutate: reject, isPending: isRejecting, error: rejectError } = useRejectAsset();
    const { mutateAsync: fetchDownloadUrl } = useAssetFileDownloadUrl();
    const [showReject, setShowReject] = useState(false);
    const [reason, setReason] = useState("");
    const [loadingFileId, setLoadingFileId] = useState<number | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [showTakeDown, setShowTakeDown] = useState(false);
    const [takeDownReason, setTakeDownReason] = useState("");
    const takeDown = useTakeDownAdminAsset();
    const isReviewing = isApproving || isRejecting;

    function handleApprove() {
        approve(assetId, { onSuccess: () => navigate(backTo) });
    }
    function handleReject() {
        if (!reason.trim()) return;
        reject({ assetId, reason: reason.trim() }, { onSuccess: () => navigate(backTo) });
    }
    async function handleOpenFile(fileId: number) {
        setFileError(null);
        setLoadingFileId(fileId);
        try {
            const url = await fetchDownloadUrl({ assetId, fileId });
            window.open(url, "_blank", "noopener,noreferrer");
        } catch (fileDownloadError) {
            setFileError(getErrorMessage(fileDownloadError));
        } finally { setLoadingFileId(null); }
    }

    const portfolio = portfolioHref(asset?.store?.portfolioLink);

    return (
        <div className="admin-dashboard-theme min-h-screen bg-background px-4 py-8 text-foreground sm:px-8 sm:py-10">
            <div className="mx-auto max-w-[1200px] space-y-6">
                <Link to={backTo} className="inline-flex items-center gap-2 rounded text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><ArrowLeft className="size-3.5" />{fromAllAssets ? "Back to all assets" : "Back to pending reviews"}</Link>
                {isLoading ? <div role="status" className="flex items-center gap-3 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading asset details…</div> : error || !asset ? (
                    <Card className="rounded-xl ring-border"><CardContent className="space-y-4"><p role="alert" className="text-sm text-red-700">{error ? getErrorMessage(error) : "Asset not found."}</p><Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>Try again</Button></CardContent></Card>
                ) : <>
                    <header className="flex flex-wrap items-start justify-between gap-5 pb-2">
                        <div className="min-w-0 flex-1"><p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Marketplace inventory · Asset #{asset.id}</p><h1 className="break-words text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{asset.title}</h1><p className="mt-3 text-xs leading-5 text-muted-foreground">{CATEGORY_LABELS[asset.category]}<span className="mx-2">·</span>{asset.listingType === "BLOCKCHAIN" ? "Blockchain (NFT)" : "Traditional listing"}<span className="mx-2">·</span>By {asset.seller.name}</p></div>
                        <div className="flex shrink-0 flex-col items-end gap-3">
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium ${STATUS_STYLES[asset.status]}`}><span className="size-1.5 rounded-full bg-current" />{STATUS_LABELS[asset.status]}</span>
                            {asset.status === "PUBLISHED" && <Button variant="outline" className="h-11 min-w-36 border-red-200 px-6 text-sm font-semibold text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => { takeDown.reset(); setTakeDownReason(""); setShowTakeDown(true); }}>Take down</Button>}
                        </div>
                    </header>

                    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                        <div className="min-w-0 space-y-6">
                            <Card className="gap-6 rounded-xl py-6 ring-border">
                                <CardHeader className="px-5 sm:px-6"><SectionHeading icon={<Package className="size-4" />} title="Asset overview" description="Listing information and licensing at a glance." /></CardHeader>
                                <CardContent className="space-y-6 px-5 sm:px-6">
                                    <div><h3 className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Description</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{asset.description || "No description provided."}</p></div>
                                    <dl className="grid gap-x-6 gap-y-5 border-t border-border pt-6 sm:grid-cols-2"><Field label="Category" value={CATEGORY_LABELS[asset.category]} /><Field label="Listing type" value={asset.listingType === "BLOCKCHAIN" ? "Blockchain (NFT)" : "Traditional"} /><Field label="AI-generated" value={asset.isAiGenerated ? "Yes" : "No"} /><Field label="Asset ID" value={`#${asset.id}`} /></dl>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {[
                                            { label: "Personal license", fiat: asset.pricePersonal, sol: asset.priceSolPersonal ?? asset.priceSol },
                                            { label: "Commercial license", fiat: asset.priceCommercial, sol: asset.priceSolCommercial ?? asset.priceSol },
                                        ].map(({ label, fiat, sol }) => <div key={label} className="rounded-lg border border-border bg-background p-4"><p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold tracking-tight tabular-nums">{asset.listingType === "BLOCKCHAIN" ? formatSol(sol) : formatPrice(fiat, asset.currency)}</p><p className="mt-1 text-[10px] text-muted-foreground">{asset.listingType === "BLOCKCHAIN" ? "SOL · Devnet" : asset.currency}</p></div>)}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="gap-6 rounded-xl py-6 ring-border">
                                <CardHeader className="px-5 sm:px-6"><div className="flex items-start justify-between gap-3"><SectionHeading icon={<FolderOpen className="size-4" />} title="Asset files" description="Inspect uploaded files before making a decision." /><span className="rounded-md bg-secondary px-2.5 py-1 text-[10px] font-medium text-secondary-foreground">{asset.files.length} files</span></div></CardHeader>
                                <CardContent className="px-5 sm:px-6">
                                    {asset.files.length === 0 ? <div className="rounded-lg border border-dashed border-border bg-background px-5 py-10 text-center"><FolderOpen className="mx-auto mb-3 size-7 text-[#7a8568]" /><p className="text-sm font-medium">No files uploaded</p><p className="mt-2 text-xs text-muted-foreground">Files will appear here when the seller adds them.</p></div> : <ul className="divide-y divide-border">{asset.files.map((file, index) => <li key={file.id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-[#657152]"><File className="size-4" aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="break-all text-xs font-medium">{file.fileType}</p><p className="mt-1.5 text-[10px] text-muted-foreground">{file.purpose === "ORIGINAL" ? "Original" : "Preview"}<span className="mx-1.5">·</span>{formatSize(file.fileSize)}<span className="mx-1.5">·</span>File {index + 1}</p></div><Button size="sm" variant="outline" className="gap-2 text-xs" disabled={loadingFileId !== null} onClick={() => void handleOpenFile(file.id)} aria-label={`View or download file ${index + 1}`}>
                                        {loadingFileId === file.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <ArrowDownToLine className="size-3.5" />}{loadingFileId === file.id ? "Opening…" : "View / Download"}
                                    </Button></li>)}</ul>}
                                    {fileError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{fileError}</p>}
                                </CardContent>
                            </Card>
                        </div>

                        <aside aria-label="Seller and asset review" className="min-w-0 space-y-6">
                            <Card className="gap-5 rounded-xl py-6 ring-border">
                                <CardHeader className="px-5"><SectionHeading icon={<Store className="size-4" />} title="Store & seller" description="The creator behind this listing." /></CardHeader>
                                <CardContent className="space-y-5 px-5">
                                    <div className="rounded-lg bg-background p-4"><p className="break-words text-sm font-semibold">{asset.store?.storeName || "No store information"}</p><p className="mt-1 text-xs text-muted-foreground">{asset.seller.name}</p></div>
                                    <dl className="space-y-5"><Field label="Email" value={asset.seller.email} /><Field label="Why they sell" value={asset.store?.reason} /><Field label="Portfolio" value={portfolio ? <a href={portfolio} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[#555e49] hover:underline">Visit portfolio<ArrowUpRight className="size-3.5" /></a> : asset.store?.portfolioLink} /></dl>
                                </CardContent>
                            </Card>

                            <Card className="gap-5 rounded-xl py-6 ring-border"><CardHeader className="px-5"><SectionHeading icon={<CalendarDays className="size-4" />} title="Listing timeline" description="Creation and most recent changes." /></CardHeader><CardContent className="px-5"><dl className="space-y-5"><Field label="Created" value={<time dateTime={asset.createdAt}>{new Date(asset.createdAt).toLocaleString()}</time>} /><Field label="Last updated" value={<time dateTime={asset.updatedAt}>{new Date(asset.updatedAt).toLocaleString()}</time>} /></dl></CardContent></Card>

                            <Card className="gap-5 rounded-xl border-t-4 border-t-[#7a8568] py-6 ring-border">
                                <CardHeader className="px-5"><SectionHeading icon={<ShieldCheck className="size-4" />} title="Review decision" description={asset.status === "PENDING_REVIEW" ? "Help maintain marketplace quality." : "Current moderation status of this asset."} /></CardHeader>
                                <CardContent className="space-y-4 px-5">
                                    {asset.status === "PENDING_REVIEW" ? <>
                                        <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground"><Clock3 className="size-4 shrink-0 text-[#7a8568]" />Awaiting an administrator’s review.</p>
                                        {showReject ? <div className="space-y-4"><p className="text-xs leading-5 text-muted-foreground">Select a reason to share with the seller.</p><ReasonPicker presets={ASSET_REJECT_REASONS} onChange={setReason} placeholder="Select a rejection reason" contentClassName="admin-dashboard-theme" /><Button variant="destructive" className="w-full gap-2" onClick={handleReject} disabled={isReviewing || !reason.trim()}><X className="size-4" />{isRejecting ? "Rejecting…" : "Confirm rejection"}</Button><Button variant="outline" className="w-full" disabled={isReviewing} onClick={() => { setShowReject(false); setReason(""); }}>Cancel</Button></div> : <div className="space-y-2"><Button className="w-full gap-2" onClick={handleApprove} disabled={isReviewing}><Check className="size-4" />{isApproving ? "Approving…" : "Approve asset"}</Button><Button variant="outline" className="w-full gap-2" onClick={() => setShowReject(true)} disabled={isReviewing}><X className="size-4" />Reject asset</Button></div>}
                                        {(approveError || rejectError) && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{getErrorMessage(approveError || rejectError)}</p>}
                                    </> : <div className="rounded-lg bg-background p-4"><p className="flex items-center gap-2 text-sm font-medium"><CircleCheck className="size-4 text-[#7a8568]" />{STATUS_LABELS[asset.status]}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{asset.status === "PUBLISHED" ? "This asset is live on the marketplace." : asset.status === "DRAFT" ? "The seller has not submitted this asset for review." : "This asset is currently unavailable on the marketplace."}</p></div>}
                                    {asset.rejectionReason && <div className="border-t border-border pt-4"><p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Moderation reason</p><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6">{asset.rejectionReason}</p></div>}
                                </CardContent>
                            </Card>
                        </aside>
                    </div>
                    <Dialog open={showTakeDown} onOpenChange={(open) => { if (!takeDown.isPending) setShowTakeDown(open); }}>
                        <DialogContent className="admin-dashboard-theme border border-border bg-card text-foreground sm:max-w-lg" showCloseButton={!takeDown.isPending}>
                            <DialogHeader>
                                <DialogTitle>Take down asset</DialogTitle>
                                <DialogDescription>Take “{asset.title}” off the marketplace. Write a reason to share with the seller.</DialogDescription>
                            </DialogHeader>
                            <form className="space-y-5" onSubmit={(event) => {
                                event.preventDefault();
                                if (!takeDownReason.trim() || takeDown.isPending) return;
                                takeDown.mutate({ assetId, reason: takeDownReason.trim() }, { onSuccess: () => { setShowTakeDown(false); setTakeDownReason(""); } });
                            }}>
                                <div className="space-y-2"><label htmlFor="asset-takedown-reason" className="text-xs font-medium">Reason for taking down <span className="text-red-700">*</span></label><Textarea id="asset-takedown-reason" placeholder="Explain why this asset is being taken down…" value={takeDownReason} onChange={(event) => setTakeDownReason(event.target.value)} rows={5} maxLength={2000} required disabled={takeDown.isPending} aria-describedby="asset-takedown-help" className="resize-y bg-background" /><p id="asset-takedown-help" className="text-xs text-muted-foreground">The reason will be saved with the asset and sent to the seller.</p></div>
                                {takeDown.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{getErrorMessage(takeDown.error)}</p>}
                                <DialogFooter><Button type="button" variant="outline" disabled={takeDown.isPending} onClick={() => setShowTakeDown(false)}>Cancel</Button><Button type="submit" variant="destructive" disabled={takeDown.isPending || !takeDownReason.trim()}>{takeDown.isPending ? "Taking down…" : "Confirm takedown"}</Button></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </>}
            </div>
        </div>
    );
}
