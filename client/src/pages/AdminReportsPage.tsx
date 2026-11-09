import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, Flag, Loader2, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import ReasonPicker from "../components/ReasonPicker";
import { useReports, useResolveReport } from "../hooks/useReport";
import { getErrorMessage } from "../lib/errors";
import { ASSET_TAKEDOWN_REASONS } from "../lib/reportReasons";
import type { AdminReport, ReportStatus } from "../types/report";

type ReportFilter = "PENDING" | "RESOLVED" | "ALL";
type ReviewStep = "review" | "take_down" | "dismiss";
const PAGE_SIZE = 10;
const STATUS_LABELS: Record<ReportStatus, string> = { PENDING: "Pending", TAKEN_DOWN: "Taken down", DISMISSED: "Dismissed" };
const STATUS_STYLES: Record<ReportStatus, string> = {
    PENDING: "bg-accent text-[#425137]",
    TAKEN_DOWN: "bg-red-50 text-red-700",
    DISMISSED: "bg-secondary text-secondary-foreground",
};
const listingTitle = (report: AdminReport) => report.asset.title || (report.asset.status === null ? "Listing unavailable" : "Untitled listing");
const reporterName = (report: AdminReport) => report.reporter.name || report.reporter.email || "Unknown reporter";
const dateLabel = (date: string) => new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function ReportStatusBadge({ status }: { status: ReportStatus }) {
    return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{STATUS_LABELS[status]}</span>;
}

export default function AdminReportsPage() {
    const reports = useReports();
    const resolve = useResolveReport();
    const searchRef = useRef<HTMLInputElement>(null);
    const actionButtonRef = useRef<HTMLButtonElement | null>(null);
    const [filter, setFilter] = useState<ReportFilter>("PENDING");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("newest");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<AdminReport | null>(null);
    const [step, setStep] = useState<ReviewStep>("review");
    const [reason, setReason] = useState("");
    const [notice, setNotice] = useState("");
    const pendingCount = reports.data?.filter((report) => report.status === "PENDING").length;
    const counts = { PENDING: pendingCount, RESOLVED: reports.data ? reports.data.length - (pendingCount ?? 0) : undefined, ALL: reports.data?.length };
    const query = search.trim().toLowerCase();
    const filtered = (reports.data ?? []).filter((report) => (filter === "ALL" || (filter === "RESOLVED" ? report.status !== "PENDING" : report.status === "PENDING"))
        && `${report.id} ${report.asset.title ?? ""} ${report.reason} ${report.reporter.name ?? ""} ${report.reporter.email ?? ""}`.toLowerCase().includes(query))
        .sort((a, b) => (Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id) * (sort === "oldest" ? 1 : -1));
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const visible = filtered.slice(start, start + PAGE_SIZE);
    const listingExists = selected !== null && selected.asset.status !== null;
    const canViewListing = listingExists && selected?.asset.status !== "TAKEN_DOWN";

    function openReport(report: AdminReport, button: HTMLButtonElement) {
        actionButtonRef.current = button;
        resolve.reset();
        setReason("");
        setStep("review");
        setNotice("");
        setSelected(report);
    }

    function changeStep(next: ReviewStep) {
        resolve.reset();
        if (next === "take_down") setReason("");
        setStep(next);
    }

    function confirmResolution() {
        if (!selected || selected.status !== "PENDING" || resolve.isPending || step === "review") return;
        if (step === "take_down" && (!reason.trim() || !listingExists)) return;
        resolve.mutate({ reportId: selected.id, action: step, ...(step === "take_down" ? { reason: reason.trim() } : {}) }, {
            onSuccess: () => {
                setNotice(`Report #${selected.id} ${step === "take_down" ? "resolved. Listing taken down." : "dismissed."}`);
                setSelected(null);
                setReason("");
            },
        });
    }

    return (
        <main className="admin-dashboard-theme min-h-[calc(100dvh-72px)] bg-background px-4 py-8 text-foreground sm:px-8 sm:py-10">
            <div className="mx-auto max-w-[1200px] space-y-6">
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none"><ArrowLeft className="size-3.5" aria-hidden="true" />Dashboard</Link>
                    <span aria-hidden="true" className="px-1 text-border">/</span><span aria-current="page" className="text-foreground">Reports</span>
                </nav>
                <header className="flex min-h-11 items-center pb-2"><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Reports</h1></header>
                <div role="status" aria-live="polite" className={notice ? "flex items-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm text-[#425137]" : "sr-only"}>{notice && <><Check className="size-4 shrink-0" aria-hidden="true" /><p className="min-w-0 break-words">{notice}</p></>}</div>
                <Tabs value={filter} onValueChange={(value) => { setFilter(value as ReportFilter); setPage(1); }} className="gap-0 overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                        <TabsList aria-label="Report status" variant="line" className="h-11 gap-1 p-0">
                            {([{ value: "PENDING", label: "Pending" }, { value: "RESOLVED", label: "Resolved" }, { value: "ALL", label: "All" }] as const).map(({ value, label }) => <TabsTrigger key={value} value={value} className="h-11 gap-2 px-3 after:bottom-0 after:bg-primary motion-reduce:transition-none motion-reduce:after:transition-none lg:after:bottom-[-17px]">{label}<span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs tabular-nums text-secondary-foreground">{counts[value]?.toLocaleString() ?? "—"}</span></TabsTrigger>)}
                        </TabsList>
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
                            <div className="relative min-w-0 sm:w-64"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input ref={searchRef} type="search" aria-label="Search reports" placeholder="Search reports…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="h-11 bg-background/60 pl-9 text-sm" /></div>
                            <Select value={sort} onValueChange={(value) => { setSort(value); setPage(1); }}><SelectTrigger aria-label="Sort reports" className="h-11 w-full bg-background/60 sm:w-40 data-[size=default]:h-11"><SelectValue /></SelectTrigger><SelectContent className="admin-dashboard-theme"><SelectItem value="newest">Newest first</SelectItem><SelectItem value="oldest">Oldest first</SelectItem></SelectContent></Select>
                        </div>
                    </div>
                    <TabsContent value={filter} className="m-0" aria-busy={reports.isLoading}>
                        {reports.isLoading ? <div role="status" className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading reports…</div>
                            : reports.error || !reports.data ? <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center"><p className="text-sm">Unable to load reports.</p><Button variant="outline" className="h-10" disabled={reports.isFetching} onClick={() => void reports.refetch()}>Try again</Button></div>
                            : visible.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"><Flag className="mb-4 size-8 text-[#7a8568]" strokeWidth={1.5} aria-hidden="true" /><h2 className="text-base font-medium">{query ? "No reports found" : filter === "PENDING" ? "No pending reports" : filter === "RESOLVED" ? "No resolved reports" : "No reports yet"}</h2>{query && <Button variant="outline" className="mt-4 h-10" onClick={() => { setSearch(""); setPage(1); }}>Clear search</Button>}</div>
                            : <table className="w-full table-fixed text-left text-sm">
                                <caption className="sr-only">Marketplace reports and their status</caption>
                                <thead className="border-b border-border bg-background/50 text-xs text-muted-foreground"><tr>
                                    <th scope="col" className="px-4 py-3 font-medium sm:px-6">Listing &amp; reason</th>
                                    <th scope="col" className="hidden w-44 px-4 py-3 font-medium lg:table-cell">Reported by</th>
                                    <th scope="col" className="hidden w-32 px-4 py-3 font-medium sm:table-cell">Status</th>
                                    <th scope="col" className="hidden w-36 px-4 py-3 font-medium md:table-cell">Reported</th>
                                    <th scope="col" className="w-24 px-4 py-3 text-right font-medium sm:w-28 sm:px-6"><span className="sr-only">Actions</span></th>
                                </tr></thead>
                                <tbody className="divide-y divide-border">{visible.map((report) => <tr key={report.id} className="transition-colors hover:bg-background/70 motion-reduce:transition-none">
                                    <th scope="row" className="px-4 py-5 font-normal sm:px-6"><p className="break-words font-semibold leading-5 tracking-tight">{listingTitle(report)}</p><p className="mt-1.5 line-clamp-2 break-words text-xs leading-5 text-muted-foreground">{report.reason}</p><p className="mt-2 break-words text-xs text-muted-foreground lg:hidden">{reporterName(report)}<span className="md:hidden"> · {dateLabel(report.createdAt)}</span></p><div className="mt-2 sm:hidden"><ReportStatusBadge status={report.status} /></div></th>
                                    <td className="hidden break-words px-4 py-5 text-xs lg:table-cell">{reporterName(report)}</td>
                                    <td className="hidden px-4 py-5 sm:table-cell"><ReportStatusBadge status={report.status} /></td>
                                    <td className="hidden px-4 py-5 text-xs text-muted-foreground md:table-cell"><time dateTime={report.createdAt}>{dateLabel(report.createdAt)}</time></td>
                                    <td className="px-4 py-5 text-right sm:px-6"><Button variant="outline" className="h-10 bg-card px-3 text-xs motion-reduce:transition-none" aria-label={`${report.status === "PENDING" ? "Review" : "View"} report ${report.id}`} disabled={resolve.isPending || reports.isFetching} onClick={(event) => openReport(report, event.currentTarget)}>{report.status === "PENDING" ? "Review" : "View"}</Button></td>
                                </tr>)}</tbody>
                            </table>}
                        {!reports.isLoading && !reports.error && reports.data && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-6"><p role="status" className="text-xs text-muted-foreground">{filtered.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString()}` : "0"} {filtered.length === 1 ? "report" : "reports"}</p>{totalPages > 1 && <nav aria-label="Report pages" className="flex items-center gap-2"><span className="mr-2 text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span><Button variant="outline" size="icon" className="size-10" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden="true" /></Button><Button variant="outline" size="icon" className="size-10" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight aria-hidden="true" /></Button></nav>}</footer>}
                    </TabsContent>
                </Tabs>
            </div>
            <Dialog open={selected !== null} onOpenChange={(open) => { if (!open && !resolve.isPending) setSelected(null); }}>
                <DialogContent className="admin-dashboard-theme max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 sm:max-w-xl" showCloseButton={!resolve.isPending} onCloseAutoFocus={(event) => { event.preventDefault(); if (actionButtonRef.current?.isConnected) actionButtonRef.current.focus(); else searchRef.current?.focus(); }} onEscapeKeyDown={(event) => { if (resolve.isPending) event.preventDefault(); }} onInteractOutside={(event) => { if (resolve.isPending) event.preventDefault(); }}>
                    <DialogHeader className="gap-3"><DialogTitle className="pr-6 text-xl font-semibold tracking-tight">{step === "review" ? `Report #${selected?.id}` : step === "take_down" ? "Take down this listing?" : "Dismiss this report?"}</DialogTitle><DialogDescription className={step === "review" ? "sr-only" : "break-words leading-6"}>{step === "review" ? "Review the report and choose an action." : step === "take_down" ? "The listing will be removed from the marketplace. The seller will receive your reason." : "This closes the report without changing the listing."}</DialogDescription></DialogHeader>
                    {selected && <>
                        <div className="min-w-0"><div className="mb-3"><ReportStatusBadge status={selected.status} /></div><h2 className="break-words text-lg font-semibold leading-7 tracking-tight">{listingTitle(selected)}</h2>{canViewListing ? <Link to={`/admin/assets/${selected.asset.id}/review?from=all`} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-sm text-sm font-medium text-[#555e49] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">View listing<ArrowUpRight className="size-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></Link> : <p className="mt-2 text-sm text-muted-foreground">{listingExists ? "Listing taken down" : "This listing is no longer available."}</p>}</div>
                        {step === "review" ? <>
                            <dl className="grid grid-cols-2 gap-4 border-t border-border pt-5 text-sm"><div className="min-w-0"><dt className="text-xs text-muted-foreground">Reported by</dt><dd className="mt-2 break-words font-medium">{reporterName(selected)}</dd></div><div><dt className="text-xs text-muted-foreground">Reported</dt><dd className="mt-2 font-medium"><time dateTime={selected.createdAt}>{dateLabel(selected.createdAt)}</time></dd></div></dl>
                            <section aria-label="Report reason" className="min-w-0 rounded-lg bg-secondary/60 p-4"><h3 className="text-xs font-medium text-muted-foreground">Report reason</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{selected.reason}</p></section>
                        </> : step === "take_down" && <fieldset disabled={resolve.isPending} className="min-w-0 space-y-2 [&_[data-slot=select-trigger]]:h-auto [&_[data-slot=select-trigger]]:min-h-11 [&_[data-slot=select-trigger]]:whitespace-normal [&_[data-slot=select-trigger]]:text-left [&_[data-slot=select-value]]:line-clamp-none"><legend className="mb-2 text-sm font-medium">Reason (sent to seller)</legend><ReasonPicker key={selected.id} presets={ASSET_TAKEDOWN_REASONS} onChange={setReason} placeholder="Choose a reason" contentClassName="admin-dashboard-theme max-w-[calc(100vw-4rem)] [&_[data-slot=select-item]]:min-h-10" /></fieldset>}
                        {resolve.error && <p role="alert" className="text-sm text-red-700">{getErrorMessage(resolve.error, "Unable to resolve this report. Please try again.")}</p>}
                        <DialogFooter className="m-0 gap-3 rounded-none border-0 bg-transparent p-0">
                            {step === "review" ? selected.status === "PENDING" ? <><Button variant="outline" className="h-11 px-4" onClick={() => changeStep("dismiss")}>Dismiss report</Button><Button variant="destructive" className="h-11 px-4" disabled={!listingExists} onClick={() => changeStep("take_down")}>Take down listing</Button></> : <Button variant="outline" className="h-11 px-4" onClick={() => setSelected(null)}>Close</Button>
                                : <><Button variant="outline" className="h-11 px-4" disabled={resolve.isPending} onClick={() => changeStep("review")}>Back</Button><Button variant={step === "take_down" ? "destructive" : "default"} className="h-11 px-4 hover:opacity-90" disabled={resolve.isPending || (step === "take_down" && (!reason.trim() || !listingExists))} onClick={confirmResolution}>{resolve.isPending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{resolve.isPending ? (step === "take_down" ? "Taking down…" : "Dismissing…") : step === "take_down" ? "Take down listing" : "Dismiss report"}</Button></>}
                        </DialogFooter>
                    </>}
                </DialogContent>
            </Dialog>
        </main>
    );
}
