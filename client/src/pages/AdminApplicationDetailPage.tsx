import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import ReasonPicker from "../components/ReasonPicker";
import { APPLICATION_REJECT_REASONS } from "../lib/adminReasons";
import { useApplication, useIdDocumentDownloadUrl, useApproveApplication, useRejectApplication } from "../hooks/useSellerApplication";
import { getErrorMessage } from "../lib/errors";
import type { SellerApplicationStatus } from "../types/sellerApplication";

const STATUS_LABELS: Record<SellerApplicationStatus, string> = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", REVOKED: "Removed" };
const STATUS_STYLES: Record<SellerApplicationStatus, string> = {
    PENDING: "bg-secondary text-secondary-foreground", APPROVED: "bg-accent text-[#425137]", REJECTED: "bg-red-50 text-red-700", REVOKED: "bg-secondary text-secondary-foreground",
};

function httpUrl(value: string | null): URL | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:" ? url : null;
    } catch { return null; }
}

function Field({ label, value }: { label: string; value: ReactNode }) {
    return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm font-medium leading-6">{value ?? "—"}</dd></div>;
}

function ApplicationDetail({ applicationId }: { applicationId: number }) {
    const navigate = useNavigate();
    const application = useApplication(applicationId);
    const idDocument = useIdDocumentDownloadUrl();
    const approve = useApproveApplication();
    const reject = useRejectApplication();
    const actionButtonRef = useRef<HTMLButtonElement | null>(null);
    const [idUrl, setIdUrl] = useState<string | null>(null);
    const [idError, setIdError] = useState<string | null>(null);
    const [previewError, setPreviewError] = useState(false);
    const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
    const [reason, setReason] = useState("");
    const app = application.data;
    const busy = approve.isPending || reject.isPending;
    const decisionError = decision === "approve" ? approve.error : reject.error;
    const portfolio = httpUrl(app?.portfolioLink ?? null);
    const isPdf = app?.idDocumentKey?.toLowerCase().endsWith(".pdf");

    async function openId() {
        if (!app?.idDocumentKey || idDocument.isPending) return;
        setIdError(null);
        try {
            const url = await idDocument.mutateAsync(applicationId);
            if (!httpUrl(url)) throw new Error("Invalid document URL");
            setIdUrl(url);
            setPreviewError(false);
        } catch (error) {
            setIdError(getErrorMessage(error, "Unable to open the ID document. Please try again."));
        }
    }

    function openDecision(value: "approve" | "reject", button: HTMLButtonElement) {
        if (!app || app.status !== "PENDING" || busy) return;
        actionButtonRef.current = button;
        approve.reset(); reject.reset();
        setReason(""); setDecision(value);
    }

    function confirmDecision() {
        if (!app || app.status !== "PENDING" || !decision || busy || (decision === "reject" && !reason.trim())) return;
        const onSuccess = () => navigate("/admin/applications");
        if (decision === "approve") approve.mutate(applicationId, { onSuccess });
        else reject.mutate({ id: applicationId, adminNote: reason.trim() }, { onSuccess });
    }

    if (application.isLoading) return <div role="status" className="flex min-h-64 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading application…</div>;
    if (application.error || !app) return <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card px-6 text-center"><p className="text-sm">{application.error ? "Unable to load this application." : "Application not found."}</p><Button variant="outline" className="h-10" disabled={application.isFetching} onClick={() => void application.refetch()}>Try again</Button></div>;

    return <>
        <header className="flex flex-wrap items-start justify-between gap-4 pb-2"><h1 className="min-w-0 max-w-full break-words text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{app.storeName || "Unnamed store"}</h1><span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium ${STATUS_STYLES[app.status]}`}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{STATUS_LABELS[app.status]}</span></header>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-6">
                <section aria-labelledby="applicant-heading" className="overflow-hidden rounded-xl border border-border bg-card">
                    <header className="border-b border-border px-5 py-5 sm:px-6"><h2 id="applicant-heading" className="text-base font-semibold tracking-tight">Applicant</h2></header>
                    <dl className="grid gap-x-6 gap-y-6 px-5 py-6 sm:grid-cols-2 sm:px-6"><Field label="Legal name" value={app.fullName} /><Field label="Date of birth" value={app.dateOfBirth ? <time dateTime={app.dateOfBirth}>{new Date(app.dateOfBirth).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</time> : null} /><Field label="Account name" value={app.user.name || "Unnamed applicant"} /><Field label="Email" value={app.user.email} /><div className="sm:col-span-2"><Field label="Address" value={app.address} /></div></dl>
                    <div className="space-y-5 border-t border-border px-5 py-6 sm:px-6"><h2 className="text-base font-semibold tracking-tight">Application</h2><p className="whitespace-pre-wrap break-words text-sm leading-7">{app.reason || "No application details provided."}</p><dl><Field label="Portfolio" value={portfolio ? <a href={portfolio.href} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-sm text-[#555e49] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">View portfolio<ArrowUpRight className="size-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a> : app.portfolioLink ? "Link unavailable" : "Not provided"} /></dl></div>
                </section>
                <section aria-labelledby="id-heading" className="overflow-hidden rounded-xl border border-border bg-card">
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-6"><div className="flex items-center gap-2"><h2 id="id-heading" className="text-base font-semibold tracking-tight">ID document</h2>{app.idDocumentKey && <span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">{isPdf ? "PDF" : "Image"}</span>}</div>{idUrl && <div className="flex items-center gap-2"><Button variant="ghost" className="h-10 px-3 text-xs" disabled={idDocument.isPending} onClick={() => { setIdUrl(null); setIdError(null); setPreviewError(false); }}>Hide ID</Button><Button variant="outline" className="h-10 gap-2 px-3 text-xs" disabled={idDocument.isPending} onClick={() => void openId()}><RefreshCw className={`size-3.5 ${idDocument.isPending ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />{idDocument.isPending ? "Refreshing…" : "Refresh ID"}</Button></div>}</header>
                    <div className="space-y-4 p-5 sm:p-6">
                        {!app.idDocumentKey ? <p className="py-8 text-center text-sm text-muted-foreground">No ID document uploaded.</p> : !idUrl ? <div className="flex min-h-48 flex-col items-center justify-center rounded-lg bg-background px-5 py-8 text-center"><FileText className="mb-4 size-8 text-[#7a8568]" strokeWidth={1.5} aria-hidden="true" /><p className="text-sm font-medium">ID document uploaded</p><Button className="mt-5 h-11 gap-2 px-5 hover:bg-primary/90" disabled={idDocument.isPending} onClick={() => void openId()}>{idDocument.isPending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{idDocument.isPending ? "Opening…" : idError ? "Try again" : "View ID"}</Button></div>
                            : <><div className="overflow-hidden rounded-lg border border-border bg-background">{previewError ? <p role="alert" className="px-6 py-12 text-center text-sm text-muted-foreground">Unable to display the preview. Refresh the ID or open it in a new tab.</p> : isPdf ? <iframe src={idUrl} title="ID document" referrerPolicy="no-referrer" className="h-[60vh] min-h-64 w-full" onError={() => setPreviewError(true)} /> : <img src={idUrl} alt="Applicant ID document" referrerPolicy="no-referrer" className="mx-auto max-h-[65vh] max-w-full object-contain" onError={() => setPreviewError(true)} />}</div><a href={idUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-sm text-sm font-medium text-[#555e49] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Open ID in new tab<ArrowUpRight className="size-3.5" aria-hidden="true" /></a></>}
                        {idError && <p role="alert" className="text-sm text-red-700">{idError}</p>}
                    </div>
                </section>
            </div>
            <aside aria-labelledby="review-heading" className="min-w-0 rounded-xl border border-border bg-card lg:sticky lg:top-24"><header className="border-b border-border px-5 py-5"><h2 id="review-heading" className="text-base font-semibold tracking-tight">Review</h2></header><div className="space-y-6 p-5"><dl className="space-y-5"><Field label="Submitted" value={<time dateTime={app.createdAt}>{new Date(app.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time>} />{app.reviewedAt && <Field label="Reviewed" value={<time dateTime={app.reviewedAt}>{new Date(app.reviewedAt).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time>} />}</dl>{app.adminNote && <div className="border-t border-border pt-5"><h3 className="text-xs text-muted-foreground">{app.status === "REVOKED" ? "Removal reason" : app.status === "REJECTED" ? "Rejection reason" : "Review reason"}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{app.adminNote}</p></div>}{app.status === "PENDING" && <div className="space-y-3 border-t border-border pt-5"><Button className="h-11 w-full hover:bg-primary/90" disabled={busy} onClick={(event) => openDecision("approve", event.currentTarget)}>Approve application</Button><Button variant="outline" className="h-11 w-full bg-card" disabled={busy} onClick={(event) => openDecision("reject", event.currentTarget)}>Reject application</Button></div>}</div></aside>
        </div>
        <Dialog open={decision !== null} onOpenChange={(open) => { if (!open && !busy) setDecision(null); }}>
            <DialogContent className="admin-dashboard-theme max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 sm:max-w-md" showCloseButton={!busy} onCloseAutoFocus={(event) => { event.preventDefault(); if (actionButtonRef.current?.isConnected) actionButtonRef.current.focus(); }} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
                <DialogHeader className="gap-3"><DialogTitle className="pr-6 text-xl font-semibold tracking-tight">{decision === "approve" ? "Approve this application?" : "Reject this application?"}</DialogTitle><DialogDescription className="leading-6">{decision === "approve" ? "This gives the applicant seller access." : "The applicant will receive the reason you choose."}</DialogDescription></DialogHeader>
                <div className="min-w-0 rounded-lg bg-secondary/60 p-4"><p className="break-words text-sm font-semibold">{app.storeName}</p><p className="mt-1 break-words text-sm text-muted-foreground">{app.user.name || "Unnamed applicant"}</p></div>
                {decision === "reject" && <fieldset disabled={busy} className="min-w-0 space-y-2 [&_[data-slot=select-trigger]]:h-auto [&_[data-slot=select-trigger]]:min-h-11 [&_[data-slot=select-trigger]]:whitespace-normal [&_[data-slot=select-trigger]]:text-left [&_[data-slot=select-value]]:line-clamp-none"><legend className="mb-2 text-sm font-medium">Reason (sent to applicant)</legend><ReasonPicker key={applicationId} presets={APPLICATION_REJECT_REASONS} onChange={setReason} placeholder="Choose a reason" contentClassName="admin-dashboard-theme max-w-[calc(100vw-4rem)] [&_[data-slot=select-item]]:min-h-10" /></fieldset>}
                {decisionError && <p role="alert" className="text-sm text-red-700">{getErrorMessage(decisionError, "Unable to update this application. Please try again.")}</p>}
                <DialogFooter className="m-0 gap-3 rounded-none border-0 bg-transparent p-0"><Button variant="outline" className="h-11 px-4" disabled={busy} onClick={() => setDecision(null)}>Cancel</Button><Button variant={decision === "reject" ? "destructive" : "default"} className="h-11 px-4 hover:opacity-90" disabled={busy || (decision === "reject" && !reason.trim())} onClick={confirmDecision}>{busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{busy ? (decision === "approve" ? "Approving…" : "Rejecting…") : decision === "approve" ? "Approve application" : "Reject application"}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    </>;
}

export default function AdminApplicationDetailPage() {
    const { id } = useParams<{ id: string }>();
    const applicationId = Number(id);
    const validId = Number.isSafeInteger(applicationId) && applicationId > 0;
    return <main className="admin-dashboard-theme min-h-[calc(100dvh-72px)] bg-background px-4 py-8 text-foreground sm:px-8 sm:py-10"><div className="mx-auto max-w-[1200px] space-y-6"><nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><Link to="/admin/applications" className="inline-flex items-center gap-2 rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none"><ArrowLeft className="size-3.5" aria-hidden="true" />Applications</Link><span aria-hidden="true" className="px-1 text-border">/</span><span aria-current="page" className="text-foreground">{validId ? `Application #${applicationId}` : "Application"}</span></nav>{validId ? <ApplicationDetail key={applicationId} applicationId={applicationId} /> : <p role="alert" className="rounded-xl border border-border bg-card p-6 text-sm">Application not found.</p>}</div></main>;
}
