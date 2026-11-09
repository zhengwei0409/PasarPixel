import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, Loader2, Search, Store } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import ReasonPicker from "../components/ReasonPicker";
import { SELLER_REVOKE_REASONS } from "../lib/adminReasons";
import { getErrorMessage } from "../lib/errors";
import { useListApplications, useRevokeSeller, useReinstateSeller } from "../hooks/useSellerApplication";
import type { SellerApplicationWithUser } from "../types/sellerApplication";

type SellerFilter = "ALL" | "APPROVED" | "REVOKED";
const PAGE_SIZE = 10;

function SellerStatus({ active }: { active: boolean }) {
    return <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${active ? "bg-accent text-[#425137]" : "bg-secondary text-secondary-foreground"}`}>
        <span aria-hidden="true" className={`size-1.5 rounded-full ${active ? "bg-[#657152]" : "bg-[#92978b]"}`} />
        {active ? "Active" : "Removed"}
    </span>;
}

export default function AdminSellersPage() {
    const active = useListApplications("APPROVED");
    const revoked = useListApplications("REVOKED");
    const revoke = useRevokeSeller();
    const reinstate = useReinstateSeller();
    const searchRef = useRef<HTMLInputElement>(null);
    const actionButtonRef = useRef<HTMLButtonElement | null>(null);
    const [filter, setFilter] = useState<SellerFilter>("ALL");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("newest");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<SellerApplicationWithUser | null>(null);
    const [revokeNote, setRevokeNote] = useState("");
    const [notice, setNotice] = useState("");
    const loading = active.isLoading || revoked.isLoading;
    const loadError = active.isError || revoked.isError;
    const busy = revoke.isPending || reinstate.isPending;
    const removing = selected?.status === "APPROVED";
    const actionError = removing ? revoke.error : reinstate.error;
    const sellers = [...(active.data ?? []), ...(revoked.data ?? [])];
    const query = search.trim().toLowerCase();
    const filtered = sellers.filter((seller) => (filter === "ALL" || seller.status === filter)
        && `${seller.storeName} ${seller.user.name ?? ""}`.toLowerCase().includes(query))
        .sort((a, b) => sort === "name" ? a.storeName.localeCompare(b.storeName) || a.id - b.id
            : Date.parse(b.reviewedAt ?? b.createdAt) - Date.parse(a.reviewedAt ?? a.createdAt) || b.id - a.id);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const visible = filtered.slice(start, start + PAGE_SIZE);
    const counts = {
        ALL: active.data && revoked.data ? sellers.length : undefined,
        APPROVED: active.data?.length,
        REVOKED: revoked.data?.length,
    };

    function openDialog(seller: SellerApplicationWithUser) {
        revoke.reset();
        reinstate.reset();
        setRevokeNote("");
        setNotice("");
        setSelected(seller);
    }

    function confirmChange() {
        if (!selected || busy || (removing && !revokeNote.trim())) return;
        const onSuccess = () => {
            setNotice(`${selected.storeName}: seller access ${removing ? "removed" : "restored"}.`);
            setSelected(null);
            setRevokeNote("");
        };
        if (removing) revoke.mutate({ userId: selected.userId, adminNote: revokeNote.trim() }, { onSuccess });
        else reinstate.mutate(selected.userId, { onSuccess });
    }

    return (
        <main className="admin-dashboard-theme min-h-[calc(100dvh-72px)] bg-background px-4 py-8 text-foreground sm:px-8 sm:py-10">
            <div className="mx-auto max-w-[1200px] space-y-6">
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none"><ArrowLeft className="size-3.5" aria-hidden="true" />Dashboard</Link>
                    <span aria-hidden="true" className="px-1 text-border">/</span>
                    <span aria-current="page" className="text-foreground">Sellers</span>
                </nav>
                <header className="flex flex-wrap items-center justify-between gap-4 pb-2">
                    <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Sellers</h1>
                    <Button asChild className="h-11 gap-2 px-4 hover:bg-primary/90 motion-reduce:transition-none"><Link to="/admin/applications">Review applications<ArrowUpRight className="size-4" aria-hidden="true" /></Link></Button>
                </header>
                <div role="status" aria-live="polite" className={notice ? "flex items-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm text-[#425137]" : "sr-only"}>
                    {notice && <><Check className="size-4 shrink-0" aria-hidden="true" /><p className="min-w-0 break-words">{notice}</p></>}
                </div>
                <Tabs value={filter} onValueChange={(value) => { setFilter(value as SellerFilter); setPage(1); }} className="gap-0 overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex flex-col gap-4 border-b border-border px-4 pt-4 pb-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                        <TabsList aria-label="Seller status" variant="line" className="h-11 gap-1 p-0">
                            {([{ value: "ALL", label: "All" }, { value: "APPROVED", label: "Active" }, { value: "REVOKED", label: "Removed" }] as const).map(({ value, label }) => <TabsTrigger key={value} value={value} className="h-11 gap-2 px-3 after:bottom-0 lg:after:bottom-[-17px] after:bg-primary motion-reduce:transition-none motion-reduce:after:transition-none">
                                {label}<span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs tabular-nums text-secondary-foreground">{counts[value]?.toLocaleString() ?? "—"}</span>
                            </TabsTrigger>)}
                        </TabsList>
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
                            <div className="relative min-w-0 sm:w-64">
                                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                                <Input ref={searchRef} type="search" aria-label="Search sellers" placeholder="Search sellers…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="h-11 bg-background/60 pl-9 text-sm" />
                            </div>
                            <Select value={sort} onValueChange={(value) => { setSort(value); setPage(1); }}>
                                <SelectTrigger aria-label="Sort sellers" className="h-11 w-full bg-background/60 sm:w-40 data-[size=default]:h-11"><SelectValue /></SelectTrigger>
                                <SelectContent className="admin-dashboard-theme"><SelectItem value="newest">Newest first</SelectItem><SelectItem value="name">Store name A–Z</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                    <TabsContent value={filter} className="m-0" aria-busy={loading}>
                        {loading ? <div role="status" className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading sellers…</div>
                            : loadError ? <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center"><p className="text-sm">Unable to load sellers.</p><Button variant="outline" className="h-10" disabled={active.isFetching || revoked.isFetching} onClick={() => { void active.refetch(); void revoked.refetch(); }}>Try again</Button></div>
                            : visible.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"><Store className="mb-4 size-8 text-[#7a8568]" strokeWidth={1.5} aria-hidden="true" /><h2 className="text-base font-medium">{query ? "No sellers found" : filter === "APPROVED" ? "No active sellers" : filter === "REVOKED" ? "No removed sellers" : "No sellers yet"}</h2>{query && <Button variant="outline" className="mt-4 h-10" onClick={() => { setSearch(""); setPage(1); }}>Clear search</Button>}</div>
                            : <table className="w-full table-fixed text-left text-sm">
                                <caption className="sr-only">Sellers and their marketplace access</caption>
                                <thead className="border-b border-border bg-background/50 text-xs text-muted-foreground"><tr>
                                    <th scope="col" className="px-4 py-3 font-medium sm:px-6">Seller</th>
                                    <th scope="col" className="hidden w-28 px-4 py-3 font-medium sm:table-cell">Status</th>
                                    <th scope="col" className="hidden w-40 px-4 py-3 font-medium md:table-cell">Approved</th>
                                    <th scope="col" className="w-36 px-4 py-3 text-right font-medium sm:w-44 sm:px-6">Access</th>
                                </tr></thead>
                                <tbody className="divide-y divide-border">
                                    {visible.map((seller) => <tr key={seller.id} className="transition-colors hover:bg-background/70 motion-reduce:transition-none">
                                        <th scope="row" className="px-4 py-5 font-normal sm:px-6">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <Avatar className="hidden size-10 sm:flex" aria-hidden="true">
                                                    {seller.user.avatarUrl && <AvatarImage src={seller.user.avatarUrl} alt="" />}
                                                    <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">{(seller.user.name || seller.storeName).trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0"><Link to={`/admin/applications/${seller.id}`} className="block break-words rounded-sm font-semibold leading-5 tracking-tight hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{seller.storeName}</Link><p className="mt-1 break-words text-xs text-muted-foreground">{seller.user.name || "Unnamed seller"}</p><div className="mt-2 sm:hidden"><SellerStatus active={seller.status === "APPROVED"} /></div></div>
                                            </div>
                                        </th>
                                        <td className="hidden px-4 py-5 sm:table-cell"><SellerStatus active={seller.status === "APPROVED"} /></td>
                                        <td className="hidden px-4 py-5 text-xs text-muted-foreground md:table-cell">{seller.reviewedAt ? <time dateTime={seller.reviewedAt}>{new Date(seller.reviewedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</time> : "—"}</td>
                                        <td className="px-4 py-5 text-right sm:px-6"><Button variant="outline" className="h-10 bg-card px-3 text-xs motion-reduce:transition-none" aria-label={`${seller.status === "APPROVED" ? "Remove" : "Restore"} access for ${seller.storeName}`} disabled={busy || active.isFetching || revoked.isFetching} onClick={(event) => { actionButtonRef.current = event.currentTarget; openDialog(seller); }}>{seller.status === "APPROVED" ? "Remove access" : "Restore access"}</Button></td>
                                    </tr>)}
                                </tbody>
                            </table>}
                        {!loading && !loadError && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-6">
                            <p role="status" className="text-xs text-muted-foreground">{filtered.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString()}` : "0"} {filtered.length === 1 ? "seller" : "sellers"}</p>
                            {totalPages > 1 && <nav aria-label="Seller pages" className="flex items-center gap-2"><span className="mr-2 text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span><Button variant="outline" size="icon" className="size-10" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden="true" /></Button><Button variant="outline" size="icon" className="size-10" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight aria-hidden="true" /></Button></nav>}
                        </footer>}
                    </TabsContent>
                </Tabs>
            </div>
            <Dialog open={selected !== null} onOpenChange={(open) => { if (!open && !busy) setSelected(null); }}>
                <DialogContent className="admin-dashboard-theme max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 sm:max-w-md" showCloseButton={!busy} onCloseAutoFocus={(event) => { event.preventDefault(); if (actionButtonRef.current?.isConnected) actionButtonRef.current.focus(); else searchRef.current?.focus(); }} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
                    <DialogHeader className="gap-3">
                        <DialogTitle className="text-xl font-semibold tracking-tight">{removing ? "Remove seller access?" : "Restore seller access?"}</DialogTitle>
                        <DialogDescription className="break-words leading-6"><span className="font-medium text-foreground">{selected?.storeName}</span>{removing ? " will lose seller access. Their live listings will be hidden." : " can sell again. Listings hidden when access was removed will be restored."}</DialogDescription>
                    </DialogHeader>
                    {removing ? <fieldset disabled={busy} className="min-w-0 space-y-2 [&_[data-slot=select-trigger]]:h-auto [&_[data-slot=select-trigger]]:min-h-11 [&_[data-slot=select-trigger]]:whitespace-normal [&_[data-slot=select-trigger]]:text-left [&_[data-slot=select-value]]:line-clamp-none"><legend className="mb-2 text-sm font-medium">Reason (sent to seller)</legend><ReasonPicker key={selected?.id} presets={SELLER_REVOKE_REASONS} onChange={setRevokeNote} placeholder="Choose a reason" contentClassName="admin-dashboard-theme max-w-[calc(100vw-4rem)] [&_[data-slot=select-item]]:min-h-10" /></fieldset>
                        : selected?.adminNote && <div className="rounded-lg bg-secondary/60 p-3"><p className="text-xs font-medium text-muted-foreground">Removal reason</p><p className="mt-1 break-words text-sm leading-6">{selected.adminNote}</p></div>}
                    {actionError && <p role="alert" className="text-sm text-red-700">{getErrorMessage(actionError, "Unable to update seller access. Please try again.")}</p>}
                    <DialogFooter className="m-0 gap-3 rounded-none border-0 bg-transparent p-0"><Button variant="outline" className="h-11 px-4" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button><Button variant={removing ? "destructive" : "default"} className="h-11 px-4 hover:opacity-90" disabled={busy || (removing && !revokeNote.trim())} onClick={confirmChange}>{busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{busy ? (removing ? "Removing…" : "Restoring…") : removing ? "Remove access" : "Restore access"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
