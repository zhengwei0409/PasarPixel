import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, Search, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useUsers, useDeleteUser } from "../hooks/useUsers";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../lib/errors";
import type { AdminUser } from "../types/user";

const PAGE_SIZE = 10;
const userName = (user: AdminUser) => user.name.trim() || "Unnamed user";
const dateLabel = (date: string) => new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function AdminUsersPage() {
    const { user } = useAuth();
    const authId = user ? Number(user.sub) : null;
    const currentUserId = authId !== null && Number.isSafeInteger(authId) ? authId : null;
    const users = useUsers();
    const remove = useDeleteUser();
    const searchRef = useRef<HTMLInputElement>(null);
    const actionButtonRef = useRef<HTMLButtonElement | null>(null);
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("newest");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<AdminUser | null>(null);
    const [notice, setNotice] = useState("");
    const query = search.trim().toLowerCase();
    const filtered = (users.data ?? []).filter((item) => `${item.name} ${item.email ?? ""} ${item.userId}`.toLowerCase().includes(query))
        .sort((a, b) => sort === "name" ? userName(a).localeCompare(userName(b)) || a.userId - b.userId
            : (Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.userId - b.userId) * (sort === "oldest" ? 1 : -1));
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const visible = filtered.slice(start, start + PAGE_SIZE);
    const canDelete = currentUserId !== null && selected !== null && selected.userId !== currentUserId;

    function openDelete(target: AdminUser, button: HTMLButtonElement) {
        if (currentUserId === null || target.userId === currentUserId || remove.isPending) return;
        actionButtonRef.current = button;
        remove.reset();
        setNotice("");
        setSelected(target);
    }

    function confirmDelete() {
        if (!selected || !canDelete || remove.isPending) return;
        remove.mutate(selected.userId, {
            onSuccess: () => {
                setNotice(`${userName(selected)}: account deleted.`);
                setSelected(null);
            },
        });
    }

    return (
        <main className="admin-dashboard-theme min-h-[calc(100dvh-72px)] bg-background px-4 py-8 text-foreground sm:px-8 sm:py-10">
            <div className="mx-auto max-w-[1200px] space-y-6">
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none"><ArrowLeft className="size-3.5" aria-hidden="true" />Dashboard</Link>
                    <span aria-hidden="true" className="px-1 text-border">/</span><span aria-current="page" className="text-foreground">Users</span>
                </nav>
                <header className="flex min-h-11 items-center pb-2"><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Users</h1></header>
                <div role="status" aria-live="polite" className={notice ? "flex items-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm text-[#425137]" : "sr-only"}>{notice && <><Check className="size-4 shrink-0" aria-hidden="true" /><p className="min-w-0 break-words">{notice}</p></>}</div>
                <section aria-labelledby="user-list-heading" aria-busy={users.isLoading} className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                        <h2 id="user-list-heading" className="flex h-11 items-center gap-2 px-1 text-sm font-medium">All users<span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs tabular-nums text-secondary-foreground">{users.data?.length.toLocaleString() ?? "—"}</span></h2>
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
                            <div className="relative min-w-0 sm:w-64"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input ref={searchRef} type="search" aria-label="Search users" placeholder="Search users…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="h-11 bg-background/60 pl-9 text-sm" /></div>
                            <Select value={sort} onValueChange={(value) => { setSort(value); setPage(1); }}><SelectTrigger aria-label="Sort users" className="h-11 w-full bg-background/60 sm:w-40 data-[size=default]:h-11"><SelectValue /></SelectTrigger><SelectContent className="admin-dashboard-theme"><SelectItem value="newest">Newest first</SelectItem><SelectItem value="oldest">Oldest first</SelectItem><SelectItem value="name">Name A–Z</SelectItem></SelectContent></Select>
                        </div>
                    </div>
                    {users.isLoading ? <div role="status" className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading users…</div>
                        : users.error || !users.data ? <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center"><p className="text-sm">Unable to load users.</p><Button variant="outline" className="h-10" disabled={users.isFetching} onClick={() => void users.refetch()}>Try again</Button></div>
                        : visible.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"><Users className="mb-4 size-8 text-[#7a8568]" strokeWidth={1.5} aria-hidden="true" /><h3 className="text-base font-medium">{query ? "No users found" : "No users yet"}</h3>{query && <Button variant="outline" className="mt-4 h-10" onClick={() => { setSearch(""); setPage(1); }}>Clear search</Button>}</div>
                        : <table className="w-full table-fixed text-left text-sm">
                            <caption className="sr-only">Registered users</caption>
                            <thead className="border-b border-border bg-background/50 text-xs text-muted-foreground"><tr>
                                <th scope="col" className="px-4 py-3 font-medium sm:px-6">User</th>
                                <th scope="col" className="hidden w-[34%] px-4 py-3 font-medium md:table-cell">Email</th>
                                <th scope="col" className="hidden w-40 px-4 py-3 font-medium sm:table-cell">Joined</th>
                                <th scope="col" className="w-24 px-4 py-3 text-right font-medium sm:w-28 sm:px-6"><span className="sr-only">Actions</span></th>
                            </tr></thead>
                            <tbody className="divide-y divide-border">{visible.map((item) => <tr key={item.userId} className="transition-colors hover:bg-background/70 motion-reduce:transition-none">
                                <th scope="row" className="px-4 py-5 font-normal sm:px-6"><div className="flex min-w-0 items-center gap-3"><Avatar className="hidden size-10 sm:flex" aria-hidden="true">{item.avatarUrl && <AvatarImage src={item.avatarUrl} alt="" />}<AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">{userName(item).split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="min-w-0 max-w-full break-words font-semibold leading-5 tracking-tight">{userName(item)}</p>{item.userId === currentUserId && <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-[#425137]">You</span>}</div><p className="mt-1.5 break-words text-xs text-muted-foreground md:hidden">{item.email || "No email"}</p><p className="mt-1.5 text-xs text-muted-foreground sm:hidden">Joined <time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></p></div></div></th>
                                <td className="hidden break-words px-4 py-5 text-sm text-muted-foreground md:table-cell">{item.email || "—"}</td>
                                <td className="hidden px-4 py-5 text-xs text-muted-foreground sm:table-cell"><time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time></td>
                                <td className="px-4 py-5 text-right sm:px-6">{item.userId === currentUserId ? <span className="text-muted-foreground" aria-label="Your account">—</span> : <Button variant="outline" className="h-10 bg-card px-3 text-xs hover:border-red-200 hover:bg-red-50 hover:text-red-700 motion-reduce:transition-none" aria-label={`Delete user ${item.userId}: ${userName(item)}`} disabled={remove.isPending || users.isFetching || currentUserId === null} onClick={(event) => openDelete(item, event.currentTarget)}>Delete</Button>}</td>
                            </tr>)}</tbody>
                        </table>}
                    {!users.isLoading && !users.error && users.data && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-6"><p role="status" className="text-xs text-muted-foreground">{filtered.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString()}` : "0"} {filtered.length === 1 ? "user" : "users"}</p>{totalPages > 1 && <nav aria-label="User pages" className="flex items-center gap-2"><span className="mr-2 text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span><Button variant="outline" size="icon" className="size-10" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden="true" /></Button><Button variant="outline" size="icon" className="size-10" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight aria-hidden="true" /></Button></nav>}</footer>}
                </section>
            </div>
            <Dialog open={selected !== null} onOpenChange={(open) => { if (!open && !remove.isPending) setSelected(null); }}>
                <DialogContent className="admin-dashboard-theme max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto p-6 sm:max-w-md" showCloseButton={!remove.isPending} onCloseAutoFocus={(event) => { event.preventDefault(); if (actionButtonRef.current?.isConnected) actionButtonRef.current.focus(); else searchRef.current?.focus(); }} onEscapeKeyDown={(event) => { if (remove.isPending) event.preventDefault(); }} onInteractOutside={(event) => { if (remove.isPending) event.preventDefault(); }}>
                    <DialogHeader className="gap-3"><DialogTitle className="text-xl font-semibold tracking-tight">Delete user?</DialogTitle><DialogDescription className="leading-6">This permanently deletes the account and its listings, orders, and files. This cannot be undone.</DialogDescription></DialogHeader>
                    {selected && <div className="min-w-0 rounded-lg bg-secondary/60 p-4"><p className="break-words text-sm font-semibold">{userName(selected)}</p><p className="mt-1 break-words text-sm text-muted-foreground">{selected.email || "No email"}</p><p className="mt-3 text-xs text-muted-foreground">User #{selected.userId}</p></div>}
                    {remove.error && <p role="alert" className="text-sm text-red-700">{getErrorMessage(remove.error, "Unable to delete this user. Please try again.")}</p>}
                    <DialogFooter className="m-0 gap-3 rounded-none border-0 bg-transparent p-0"><Button variant="outline" className="h-11 px-4" disabled={remove.isPending} onClick={() => setSelected(null)}>Cancel</Button><Button variant="destructive" className="h-11 px-4" disabled={remove.isPending || !canDelete} onClick={confirmDelete}>{remove.isPending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{remove.isPending ? "Deleting…" : "Delete user"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
