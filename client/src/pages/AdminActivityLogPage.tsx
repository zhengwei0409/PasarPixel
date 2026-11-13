import { useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowLeft, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { ACTIVITY_CATEGORIES, type ActivityCategory, type AdminActivityFilters } from "../../../shared/types/adminActivityLog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAdminActivity } from "../hooks/useAdminActivity";
import apiClient from "../lib/apiClient";

const categories = Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[];
const utcDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

function FilterForm({ filters, apply, clear }: {
    filters: AdminActivityFilters;
    apply: (filters: URLSearchParams) => void;
    clear: () => void;
}) {
    const [dateError, setDateError] = useState(false);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const next = new URLSearchParams();
        for (const [key, value] of new FormData(event.currentTarget)) {
            if (typeof value === "string" && value.trim()) next.set(key, value.trim());
        }
        const from = next.get("from");
        const to = next.get("to");
        if (from && to && from > to) {
            setDateError(true);
            return;
        }
        apply(next);
    }

    return (
        <form aria-label="Search and filter activity" onSubmit={submit} onChange={() => setDateError(false)} className="border-b border-border p-4 sm:p-5">
            <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto_auto_auto]">
                <label className="grid gap-1.5 text-xs font-medium">
                    Search
                    <span className="relative">
                        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input name="search" type="search" defaultValue={filters.search} maxLength={200} placeholder="Action, actor, subject or reason" className="h-11 bg-background pl-9" />
                    </span>
                </label>
                <label className="grid gap-1.5 text-xs font-medium">
                    Category
                    <select name="category" defaultValue={filters.category ?? ""} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
                        <option value="">All categories</option>
                        {categories.map((category) => <option key={category} value={category}>{ACTIVITY_CATEGORIES[category]}</option>)}
                    </select>
                </label>
                <label className="grid gap-1.5 text-xs font-medium">From (UTC)
                    <Input type="date" name="from" max="9999-12-31" defaultValue={filters.from} className="h-11 bg-background" />
                </label>
                <label className="grid gap-1.5 text-xs font-medium">To (UTC)
                    <Input type="date" name="to" max="9999-12-31" defaultValue={filters.to} className="h-11 bg-background" />
                </label>
                <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
                    <Button type="submit" variant="outline" className="h-11">Apply</Button>
                    <Button type="button" variant="ghost" className="h-11" onClick={(event) => { event.currentTarget.form?.reset(); setDateError(false); clear(); }}>Clear</Button>
                </div>
            </div>
            {dateError && <p role="alert" className="mt-3 text-sm text-destructive">The end date must be on or after the start date.</p>}
        </form>
    );
}

export default function AdminActivityLogPage() {
    const [params, setParams] = useSearchParams();
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState(false);
    const rawPage = params.get("page") ?? "1";
    const page = /^[1-9]\d{0,6}$/.test(rawPage) && Number(rawPage) <= 1_000_000 ? Number(rawPage) : 1;
    const filters: AdminActivityFilters = {
        search: params.get("search")?.trim().slice(0, 200) || undefined,
        category: categories.find((category) => category === params.get("category")),
        from: params.get("from") || undefined,
        to: params.get("to") || undefined,
    };
    const activity = useAdminActivity(filters, page);
    const items = activity.data?.items ?? [];
    const filtered = Boolean(filters.search || filters.category || filters.from || filters.to);

    function setPage(next: number) {
        const updated = new URLSearchParams(params);
        if (next === 1) updated.delete("page");
        else updated.set("page", String(next));
        setParams(updated, { preventScrollReset: true });
    }

    async function exportCsv() {
        setExporting(true);
        setExportError(false);
        try {
            const { data } = await apiClient.get<Blob>("/logs/activity/export", { params: filters, responseType: "blob" });
            const url = URL.createObjectURL(data);
            const link = document.createElement("a");
            link.href = url;
            link.download = `pasarpixel-activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
            setExportError(true);
        } finally {
            setExporting(false);
        }
    }

    return (
        <main className="admin-dashboard-theme min-h-[calc(100dvh-72px)] bg-background px-4 py-8 text-foreground sm:px-8 sm:py-10">
            <div className="mx-auto max-w-[1200px] space-y-6">
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Link to="/dashboard" className="inline-flex min-h-8 items-center gap-2 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><ArrowLeft className="size-3.5" aria-hidden="true" />Dashboard</Link>
                    <span aria-hidden="true">/</span><span aria-current="page" className="text-foreground">Activity log</span>
                </nav>
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Activity log</h1>
                    <Button className="h-11" disabled={exporting || activity.isPending || activity.isError || (!items.length && page === 1)} onClick={() => void exportCsv()}>
                        <ArrowDownToLine className="size-4" aria-hidden="true" />{exporting ? "Exporting…" : "Export CSV"}
                    </Button>
                </header>
                {exportError && <p role="alert" className="text-sm text-destructive">Unable to export activity. Try again.</p>}
                <section aria-label="Activity entries" className="overflow-hidden rounded-xl border border-border bg-card">
                    <FilterForm key={JSON.stringify(filters)} filters={filters} apply={(next) => setParams(next)} clear={() => setParams({})} />
                    {activity.isPending ? <p role="status" className="p-8 text-center text-sm text-muted-foreground">Loading activity…</p>
                        : activity.isError ? <div role="alert" className="grid justify-items-center gap-3 p-8 text-center text-sm">
                            <p>Unable to load activity. Check your filters or try again.</p><Button variant="outline" onClick={() => void activity.refetch()}>Try again</Button>
                        </div>
                        : items.length === 0 ? <p role="status" className="p-8 text-center text-sm text-muted-foreground">
                            {page > 1 ? "No activity on this page." : filtered ? "No activity matches these filters." : "No activity has been recorded yet."}
                        </p> : (
                            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Activity log table">
                                <table className="w-full min-w-[680px] text-left text-sm">
                                    <caption className="sr-only">Recorded activity, newest first</caption>
                                    <thead className="border-b border-border bg-secondary/60 text-xs text-muted-foreground"><tr>
                                        {["Action", "Actor", "Subject", "Reason", "Timestamp (UTC)"].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-medium sm:px-5">{label}</th>)}
                                    </tr></thead>
                                    <tbody className="divide-y divide-border">{items.map((entry) => (
                                        <tr key={entry.id} className="align-top transition-colors hover:bg-background/60 motion-reduce:transition-none">
                                            <th scope="row" className="px-4 py-3 text-left font-medium sm:px-5">
                                                <span className="block break-words">{entry.action}</span>
                                                <span className="mt-1 block text-xs font-normal text-muted-foreground">{ACTIVITY_CATEGORIES[entry.category]}</span>
                                            </th>
                                            <td className="break-words px-4 py-3 sm:px-5">{entry.actorName || entry.actorEmail || `User #${entry.actorId}`}
                                                {entry.actorName && entry.actorEmail && <span className="mt-1 block text-xs text-muted-foreground">{entry.actorEmail}</span>}
                                            </td>
                                            <td className="break-words px-4 py-3 sm:px-5">{entry.targetLabel ?? "—"}</td>
                                            <td className="max-w-[16rem] whitespace-pre-line [overflow-wrap:anywhere] px-4 py-3 text-muted-foreground sm:px-5">{entry.reason || "—"}</td>
                                            <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground sm:px-5"><time dateTime={entry.createdAt}>{utcDate.format(new Date(entry.createdAt))}</time></td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            </div>
                        )}
                    {!activity.isPending && !activity.isError && (page > 1 || activity.data?.hasNextPage) && (
                        <nav aria-label="Activity log pages" className="flex items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
                            <span className="mr-2 text-xs text-muted-foreground">Page {page}</span>
                            <Button variant="outline" size="icon" aria-label="Previous page" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft aria-hidden="true" /></Button>
                            <Button variant="outline" size="icon" aria-label="Next page" disabled={!activity.data?.hasNextPage} onClick={() => setPage(page + 1)}><ChevronRight aria-hidden="true" /></Button>
                        </nav>
                    )}
                </section>
            </div>
        </main>
    );
}
