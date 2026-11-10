import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import ReasonPicker from "../components/ReasonPicker";
import { APPLICATION_REJECT_REASONS } from "../lib/adminReasons";
import { getErrorMessage } from "../lib/errors";
import { useListApplications, useApproveApplication, useRejectApplication } from "../hooks/useSellerApplication";
import type { SellerApplicationStatus, SellerApplicationWithUser } from "../types/sellerApplication";

type ApplicationFilter = "PENDING" | "REVIEWED" | "ALL";
type ReviewStep = "review" | "approve" | "reject";
const PAGE_SIZE = 10;
const STATUS_LABELS: Record<SellerApplicationStatus, string> = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", REVOKED: "Removed" };
const STATUS_STYLES: Record<SellerApplicationStatus, string> = {
    PENDING: "bg-secondary text-secondary-foreground", APPROVED: "bg-accent text-[#425137]", REJECTED: "bg-red-50 text-red-700", REVOKED: "bg-secondary text-secondary-foreground",
};
const dateLabel = (date: string) => new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function portfolioUrl(value: string | null): string | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch { return null; }
}

function ApplicationStatus({ status }: { status: SellerApplicationStatus }) {
    return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{STATUS_LABELS[status]}</span>;
}

export default function AdminApplicationsPage() {
    const applications = useListApplications();
    const approve = useApproveApplication();
    const reject = useRejectApplication();
    const searchRef = useRef<HTMLInputElement>(null);
    const actionButtonRef = useRef<HTMLButtonElement | null>(null);
    const [filter, setFilter] = useState<ApplicationFilter>("PENDING");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("newest");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<SellerApplicationWithUser | null>(null);
    const [step, setStep] = useState<ReviewStep>("review");
    const [reason, setReason] = useState("");
    const [notice, setNotice] = useState("");
    const busy = approve.isPending || reject.isPending;
    const actionError = step === "approve" ? approve.error : step === "reject" ? reject.error : null;
    const pendingCount = applications.data?.filter((item) => item.status === "PENDING").length;
    const counts = { PENDING: pendingCount, REVIEWED: applications.data ? applications.data.length - (pendingCount ?? 0) : undefined, ALL: applications.data?.length };
    const query = search.trim().toLowerCase();
    const filtered = (applications.data ?? []).filter((item) => (filter === "ALL" || (filter === "REVIEWED" ? item.status !== "PENDING" : item.status === "PENDING"))
        && `${item.id} ${item.storeName} ${item.user.name ?? ""} ${item.fullName ?? ""} ${item.reason}`.toLowerCase().includes(query))
        .sort((a, b) => sort === "name" ? a.storeName.localeCompare(b.storeName) || a.id - b.id
            : (Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id) * (sort === "oldest" ? 1 : -1));
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const visible = filtered.slice(start, start + PAGE_SIZE);
    const portfolio = portfolioUrl(selected?.portfolioLink ?? null);

    function openApplication(application: SellerApplicationWithUser, button: HTMLButtonElement) {
        actionButtonRef.current = button;
        approve.reset(); reject.reset();
        setReason(""); setStep("review"); setNotice(""); setSelected(application);
    }

    function changeStep(next: ReviewStep) {
        approve.reset(); reject.reset();
        if (next === "reject") setReason("");
        setStep(next);
    }

    function confirmReview() {
        if (!selected || selected.status !== "PENDING" || busy || step === "review" || (step === "reject" && !reason.trim())) return;
        const onSuccess = () => {
            setNotice(`Application #${selected.id} ${step === "approve" ? "approved" : "rejected"}.`);
            setSelected(null); setReason("");
        };
        if (step === "approve") approve.mutate(selected.id, { onSuccess });
        else reject.mutate({ id: selected.id, adminNote: reason.trim() }, { onSuccess });
    }

    return (
        <main className="admin-dashboard-theme min-h-[calc(100dvh-72px)] bg-background px-4 py-8 text-foreground sm:px-8 sm:py-10">
            <div className="mx-auto max-w-[1200px] space-y-6">
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground"><Link to="/dashboard" className="inline-flex items-center gap-2 rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none"><ArrowLeft className="size-3.5" aria-hidden="true" />Dashboard</Link><span aria-hidden="true" className="px-1 text-border">/</span><span aria-current="page" className="text-foreground">Applications</span></nav>
                <header className="flex flex-wrap items-center justify-between gap-4 pb-2"><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Seller applications</h1><Button asChild variant="outline" className="h-11 gap-2 bg-card px-4 motion-reduce:transition-none"><Link to="/admin/sellers">Manage sellers<ArrowUpRight className="size-4" aria-hidden="true" /></Link></Button></header>
                <div role="status" aria-live="polite" className={notice ? "flex items-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm text-[#425137]" : "sr-only"}>{notice && <><Check className="size-4 shrink-0" aria-hidden="true" /><p className="min-w-0 break-words">{notice}</p></>}</div>
                <Tabs value={filter} onValueChange={(value) => { setFilter(value as ApplicationFilter); setPage(1); }} className="gap-0 overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                        <TabsList aria-label="Application status" variant="line" className="h-11 gap-1 p-0">{([{ value: "PENDING", label: "Pending" }, { value: "REVIEWED", label: "Reviewed" }, { value: "ALL", label: "All" }] as const).map(({ value, label }) => <TabsTrigger key={value} value={value} className="h-11 gap-2 px-3 after:bottom-0 after:bg-primary motion-reduce:transition-none motion-reduce:after:transition-none lg:after:bottom-[-17px]">{label}<span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs tabular-nums text-secondary-foreground">{counts[value]?.toLocaleString() ?? "—"}</span></TabsTrigger>)}</TabsList>
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row"><div className="relative min-w-0 sm:w-64"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input ref={searchRef} type="search" aria-label="Search applications" placeholder="Search applications…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="h-11 bg-background/60 pl-9 text-sm" /></div><Select value={sort} onValueChange={(value) => { setSort(value); setPage(1); }}><SelectTrigger aria-label="Sort applications" className="h-11 w-full bg-background/60 sm:w-40 data-[size=default]:h-11"><SelectValue /></SelectTrigger><SelectContent className="admin-dashboard-theme"><SelectItem value="newest">Newest first</SelectItem><SelectItem value="oldest">Oldest first</SelectItem><SelectItem value="name">Store name A–Z</SelectItem></SelectContent></Select></div>
                    </div>
                    <TabsContent value={filter} className="m-0" aria-busy={applications.isLoading}>
                        {applications.isLoading ? <div role="status" className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading applications…</div>
                            : applications.error || !applications.data ? <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center"><p className="text-sm">Unable to load applications.</p><Button variant="outline" className="h-10" disabled={applications.isFetching} onClick={() => void applications.refetch()}>Try again</Button></div>
                            : visible.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"><ClipboardCheck className="mb-4 size-8 text-[#7a8568]" strokeWidth={1.5} aria-hidden="true" /><h2 className="text-base font-medium">{query ? "No applications found" : filter === "PENDING" ? "No pending applications" : filter === "REVIEWED" ? "No reviewed applications" : "No applications yet"}</h2>{query && <Button variant="outline" className="mt-4 h-10" onClick={() => { setSearch(""); setPage(1); }}>Clear search</Button>}</div>
                            : <table className="w-full table-fixed text-left text-sm"><caption className="sr-only">Seller applications and their status</caption><thead className="border-b border-border bg-background/50 text-xs text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium sm:px-6">Store &amp; applicant</th><th scope="col" className="hidden w-[30%] px-4 py-3 font-medium lg:table-cell">Application</th><th scope="col" className="hidden w-28 px-4 py-3 font-medium sm:table-cell">Status</th><th scope="col" className="hidden w-36 px-4 py-3 font-medium md:table-cell">Submitted</th><th scope="col" className="w-24 px-4 py-3 text-right font-medium sm:w-28 sm:px-6"><span className="sr-only">Actions</span></th></tr></thead>
                                <tbody className="divide-y divide-border">{visible.map((item) => <tr key={item.id} className="transition-colors hover:bg-background/70 motion-reduce:transition-none"><th scope="row" className="px-4 py-5 font-normal sm:px-6"><div className="flex min-w-0 items-center gap-3"><Avatar className="hidden size-10 sm:flex" aria-hidden="true">{item.user.avatarUrl && <AvatarImage src={item.user.avatarUrl} alt="" />}<AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">{(item.user.name || item.storeName).trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><p className="break-words font-semibold leading-5 tracking-tight">{item.storeName}</p><p className="mt-1.5 break-words text-xs text-muted-foreground">{item.user.name || "Unnamed applicant"}</p><p className="mt-2 text-xs text-muted-foreground md:hidden"><time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></p><div className="mt-2 sm:hidden"><ApplicationStatus status={item.status} /></div></div></div></th><td className="hidden px-4 py-5 lg:table-cell"><p className="line-clamp-2 break-words text-xs leading-5 text-muted-foreground">{item.reason}</p></td><td className="hidden px-4 py-5 sm:table-cell"><ApplicationStatus status={item.status} /></td><td className="hidden px-4 py-5 text-xs text-muted-foreground md:table-cell"><time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></td><td className="px-4 py-5 text-right sm:px-6"><Button variant="outline" className="h-10 bg-card px-3 text-xs motion-reduce:transition-none" aria-label={`${item.status === "PENDING" ? "Review" : "View"} application ${item.id}`} disabled={busy || applications.isFetching} onClick={(event) => openApplication(item, event.currentTarget)}>{item.status === "PENDING" ? "Review" : "View"}</Button></td></tr>)}</tbody>
                            </table>}
                        {!applications.isLoading && !applications.error && applications.data && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-6"><p role="status" className="text-xs text-muted-foreground">{filtered.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString()}` : "0"} {filtered.length === 1 ? "application" : "applications"}</p>{totalPages > 1 && <nav aria-label="Application pages" className="flex items-center gap-2"><span className="mr-2 text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span><Button variant="outline" size="icon" className="size-10" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden="true" /></Button><Button variant="outline" size="icon" className="size-10" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight aria-hidden="true" /></Button></nav>}</footer>}
                    </TabsContent>
                </Tabs>
            </div>
            <Dialog open={selected !== null} onOpenChange={(open) => { if (!open && !busy) setSelected(null); }}>
                <DialogContent className="admin-dashboard-theme max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 sm:max-w-xl" showCloseButton={!busy} onCloseAutoFocus={(event) => { event.preventDefault(); if (actionButtonRef.current?.isConnected) actionButtonRef.current.focus(); else searchRef.current?.focus(); }} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
                    <DialogHeader className="gap-3"><DialogTitle className="pr-6 text-xl font-semibold tracking-tight">{step === "review" ? `Application #${selected?.id}` : step === "approve" ? "Approve this application?" : "Reject this application?"}</DialogTitle><DialogDescription className={step === "review" ? "sr-only" : "leading-6"}>{step === "review" ? "Review the application and choose an action." : step === "approve" ? "This gives the applicant seller access." : "The applicant will receive the reason you choose."}</DialogDescription></DialogHeader>
                    {selected && <><div className="min-w-0"><div className="mb-3"><ApplicationStatus status={selected.status} /></div><h2 className="break-words text-lg font-semibold leading-7 tracking-tight">{selected.storeName}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{selected.user.name || "Unnamed applicant"}</p>{step === "review" && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1"><Link to={`/admin/applications/${selected.id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-sm text-sm font-medium text-[#555e49] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">View details &amp; ID<ArrowUpRight className="size-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></Link>{portfolio && <a href={portfolio} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-sm text-sm font-medium text-[#555e49] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Portfolio<ArrowUpRight className="size-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>}</div>}</div>
                        {step === "review" ? <><dl className="grid grid-cols-2 gap-4 border-t border-border pt-5 text-sm"><div><dt className="text-xs text-muted-foreground">Submitted</dt><dd className="mt-2 font-medium"><time dateTime={selected.createdAt}>{dateLabel(selected.createdAt)}</time></dd></div><div><dt className="text-xs text-muted-foreground">ID document</dt><dd className="mt-2 font-medium">{selected.idDocumentKey ? "Uploaded" : "Not uploaded"}</dd></div></dl><section aria-label="Application details" className="min-w-0 rounded-lg bg-secondary/60 p-4"><h3 className="text-xs font-medium text-muted-foreground">Application</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{selected.reason}</p></section>{selected.adminNote && <section aria-label="Review reason" className="min-w-0 border-t border-border pt-5"><h3 className="text-xs font-medium text-muted-foreground">{selected.status === "REVOKED" ? "Removal reason" : "Review reason"}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{selected.adminNote}</p></section>}</>
                            : step === "reject" && <fieldset disabled={busy} className="min-w-0 space-y-2 [&_[data-slot=select-trigger]]:h-auto [&_[data-slot=select-trigger]]:min-h-11 [&_[data-slot=select-trigger]]:whitespace-normal [&_[data-slot=select-trigger]]:text-left [&_[data-slot=select-value]]:line-clamp-none"><legend className="mb-2 text-sm font-medium">Reason (sent to applicant)</legend><ReasonPicker key={selected.id} presets={APPLICATION_REJECT_REASONS} onChange={setReason} placeholder="Choose a reason" contentClassName="admin-dashboard-theme max-w-[calc(100vw-4rem)] [&_[data-slot=select-item]]:min-h-10" /></fieldset>}
                        {actionError && <p role="alert" className="text-sm text-red-700">{getErrorMessage(actionError, "Unable to update this application. Please try again.")}</p>}
                        <DialogFooter className="m-0 gap-3 rounded-none border-0 bg-transparent p-0">{step === "review" ? selected.status === "PENDING" ? <><Button variant="outline" className="h-11 px-4" onClick={() => changeStep("reject")}>Reject</Button><Button className="h-11 px-4 hover:bg-primary/90" onClick={() => changeStep("approve")}>Approve</Button></> : <Button variant="outline" className="h-11 px-4" onClick={() => setSelected(null)}>Close</Button> : <><Button variant="outline" className="h-11 px-4" disabled={busy} onClick={() => changeStep("review")}>Back</Button><Button variant={step === "reject" ? "destructive" : "default"} className="h-11 px-4 hover:opacity-90" disabled={busy || (step === "reject" && !reason.trim())} onClick={confirmReview}>{busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{busy ? (step === "approve" ? "Approving…" : "Rejecting…") : step === "approve" ? "Approve application" : "Reject application"}</Button></>}</DialogFooter>
                    </>}
                </DialogContent>
            </Dialog>
        </main>
    );
}
