import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, ReceiptText, Search } from "lucide-react";
import OrderStatus from "../components/orders/OrderStatus";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useAdminTransactions } from "../hooks/useAdminTransactions";
import { formatLamportsSol } from "../lib/price";
import {
    ADMIN_PAYMENT_METHODS, ADMIN_PAYMENT_STATUSES, ADMIN_WITHDRAWAL_STATUSES,
    type AdminTransaction, type AdminTransactionFilters,
} from "../../../shared/types/adminTransaction";

const STATUS_LABELS = {
    PENDING: "Pending", COMPLETED: "Completed", FAILED: "Failed", REFUNDED: "Refunded",
    APPROVED: "Approved", REJECTED: "Rejected", PAID: "Paid",
};
const WITHDRAWAL_STYLES = {
    PENDING: "bg-[#f6efdf] text-[#886928]",
    APPROVED: "bg-[#eceee7] text-[#555e49]",
    REJECTED: "bg-[#f8eae6] text-[#9b5141]",
    PAID: "bg-[#edf1e6] text-[#536442]",
};
const METHOD_LABELS = { STRIPE: "Stripe", SOL: "SOL" };
const filterClass = "h-11 w-full bg-background/60 data-[size=default]:h-11";

function titleOf(transaction: AdminTransaction) {
    return `${transaction.kind === "purchase" ? "Order" : "Withdrawal"} #${transaction.id}`;
}

function amountOf(transaction: AdminTransaction) {
    if (transaction.kind === "purchase" && transaction.method === "SOL") {
        return formatLamportsSol(transaction.totalLamports);
    }
    return new Intl.NumberFormat(undefined, { style: "currency", currency: transaction.currency, currencyDisplay: "code" }).format(Number(transaction.amount));
}

function accountName(transaction: AdminTransaction) {
    return transaction.account.name.trim() || transaction.account.email || `User #${transaction.account.userId}`;
}

function DateLabel({ value, detailed = false }: { value: string; detailed?: boolean }) {
    return <time dateTime={value}>{new Date(value).toLocaleString(undefined, detailed
        ? { dateStyle: "medium", timeStyle: "short" }
        : { dateStyle: "medium" })}</time>;
}

function TransactionStatus({ transaction }: { transaction: AdminTransaction }) {
    if (transaction.kind === "purchase") return <OrderStatus status={transaction.status} />;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${WITHDRAWAL_STYLES[transaction.status]}`}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {STATUS_LABELS[transaction.status]}
        </span>
    );
}

function SearchForm({ search, purchases, onSearch }: { search: string; purchases: boolean; onSearch: (value: string) => void }) {
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        onSearch(String(new FormData(event.currentTarget).get("search") ?? "").trim());
    }
    return (
        <form role="search" className="flex min-w-0 flex-1 gap-2" onSubmit={submit}>
            <div className="relative min-w-0 flex-1">
                <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input name="search" type="search" aria-label={purchases ? "Search purchases" : "Search withdrawals"}
                    defaultValue={search} maxLength={200} className="h-11 bg-background/60 pl-9"
                    placeholder={purchases ? "ID, buyer or ref…" : "ID or seller…"} />
            </div>
            <Button type="submit" variant="outline" className="h-11">Search</Button>
        </form>
    );
}

function TransactionDetails({ transaction, close, restoreFocus }: {
    transaction: AdminTransaction | null;
    close: () => void;
    restoreFocus: () => void;
}) {
    return (
        <Dialog open={transaction !== null} onOpenChange={(open) => { if (!open) close(); }}>
            <DialogContent className="admin-dashboard-theme max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
                onCloseAutoFocus={(event) => { event.preventDefault(); restoreFocus(); }}>
                {transaction && <>
                    <DialogHeader>
                        <DialogTitle>{titleOf(transaction)}</DialogTitle>
                        <DialogDescription>{transaction.kind === "purchase" ? "Purchase details" : "Withdrawal request details"}</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/65 px-4 py-3">
                        <p className="break-all text-xl font-semibold tabular-nums">{amountOf(transaction)}</p>
                        <TransactionStatus transaction={transaction} />
                    </div>
                    <dl className="divide-y divide-border text-sm">
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 py-3">
                            <dt className="text-muted-foreground">{transaction.kind === "purchase" ? "Buyer" : "Seller"}</dt>
                            <dd className="min-w-0 break-words font-medium">
                                <Link to={`/admin/users/${transaction.account.userId}`} className="rounded-sm underline decoration-border underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-ring">{accountName(transaction)}</Link>
                                <span className="mt-1 block text-xs font-normal text-muted-foreground">{transaction.account.email && transaction.account.email !== accountName(transaction) && <>{transaction.account.email}<br /></>}User #{transaction.account.userId}</span>
                            </dd>
                        </div>
                        <Detail label="Created"><DateLabel value={transaction.createdAt} detailed /></Detail>
                        <Detail label="Last updated"><DateLabel value={transaction.updatedAt} detailed /></Detail>
                        {transaction.kind === "purchase" && <>
                            <Detail label="Payment method">{METHOD_LABELS[transaction.method]}</Detail>
                            <Detail label="Items">{transaction.itemCount.toLocaleString()}</Detail>
                            <Detail label={transaction.referenceLabel}>{transaction.reference ? <code className="break-all text-xs">{transaction.reference}</code> : "Unavailable"}</Detail>
                        </>}
                    </dl>
                </>}
            </DialogContent>
        </Dialog>
    );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
    return <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 py-3">
        <dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{children}</dd>
    </div>;
}

export default function AdminTransactionsPage() {
    const [params, setParams] = useSearchParams();
    const [selected, setSelected] = useState<AdminTransaction | null>(null);
    const detailsButton = useRef<HTMLButtonElement>(null);
    const purchases = params.get("kind") !== "withdrawal";
    const kind = purchases ? "purchase" : "withdrawal";
    const search = (params.get("search") ?? "").trim().slice(0, 200);
    const status = params.get("status");
    const method = ADMIN_PAYMENT_METHODS.find((value) => value === params.get("method"));
    const pageParam = params.get("page") ?? "1";
    const page = /^\d+$/.test(pageParam) && Number(pageParam) >= 1 && Number(pageParam) <= 1_000_000 ? Number(pageParam) : 1;
    const base = { page, search: search || undefined };
    const filters: AdminTransactionFilters = purchases
        ? { ...base, kind: "purchase", status: ADMIN_PAYMENT_STATUSES.find((value) => value === status), method }
        : { ...base, kind: "withdrawal", status: ADMIN_WITHDRAWAL_STATUSES.find((value) => value === status) };
    const transactions = useAdminTransactions(filters);
    const data = transactions.data;
    const hasFilters = Boolean(search || filters.status || (purchases && method));
    const rows = data?.items ?? [];
    const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
    const firstRow = data && rows.length ? (data.page - 1) * data.pageSize + 1 : 0;

    function update(key: string, value: string) {
        setParams((previous) => {
            const next = new URLSearchParams(previous);
            if (value) next.set(key, value);
            else next.delete(key);
            if (key !== "page") next.delete("page");
            return next;
        }, { preventScrollReset: true });
    }

    function clearFilters() {
        setParams(purchases ? {} : { kind: "withdrawal" }, { preventScrollReset: true });
    }

    const th = "px-4 py-3 text-left text-xs font-medium text-muted-foreground sm:px-6";

    return (
        <main className="admin-dashboard-theme min-h-[calc(100dvh-72px)] bg-background px-4 py-8 text-foreground sm:px-8 sm:py-10">
            <div className="mx-auto max-w-[1200px] space-y-6">
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Link to="/dashboard" className="inline-flex min-h-8 items-center gap-2 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><ArrowLeft className="size-3.5" aria-hidden="true" />Dashboard</Link>
                    <span aria-hidden="true">/</span><span aria-current="page" className="text-foreground">Transactions</span>
                </nav>
                <header>
                    <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Transactions</h1>
                </header>
                <section aria-label={purchases ? "Purchases" : "Withdrawals"} aria-busy={transactions.isFetching} className="overflow-hidden rounded-xl border border-border bg-card">
                    <nav aria-label="Transaction type" className="flex gap-5 border-b border-border px-4 sm:px-6">
                        {([{ label: "Purchases", to: "/admin/transactions", active: purchases },
                            { label: "Withdrawals", to: "/admin/transactions?kind=withdrawal", active: !purchases }]).map(({ label, to, active }) => (
                            <Link key={label} to={to} preventScrollReset aria-current={active ? "page" : undefined}
                                className={`inline-flex min-h-12 items-center border-b-2 px-1 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-ring ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</Link>
                        ))}
                    </nav>
                    <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row sm:px-6">
                        <SearchForm key={`${kind}:${search}`} search={search} purchases={purchases} onSearch={(value) => update("search", value)} />
                        <div className={`grid gap-3 ${purchases ? "grid-cols-2" : "grid-cols-1"}`}>
                            {purchases && <Select value={method ?? "ALL"} onValueChange={(value) => update("method", value === "ALL" ? "" : value)}>
                                <SelectTrigger aria-label="Filter by payment method" className={`${filterClass} lg:w-40`}><SelectValue /></SelectTrigger>
                                <SelectContent className="admin-dashboard-theme">
                                    <SelectItem value="ALL">All methods</SelectItem>
                                    {ADMIN_PAYMENT_METHODS.map((value) => <SelectItem key={value} value={value}>{METHOD_LABELS[value]}</SelectItem>)}
                                </SelectContent>
                            </Select>}
                            <Select value={filters.status ?? "ALL"} onValueChange={(value) => update("status", value === "ALL" ? "" : value)}>
                                <SelectTrigger aria-label="Filter by status" className={`${filterClass} lg:w-40`}><SelectValue /></SelectTrigger>
                                <SelectContent className="admin-dashboard-theme">
                                    <SelectItem value="ALL">All statuses</SelectItem>
                                    {(purchases ? ADMIN_PAYMENT_STATUSES : ADMIN_WITHDRAWAL_STATUSES).map((value) => <SelectItem key={value} value={value}>{STATUS_LABELS[value]}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {transactions.isPending ? <div role="status" className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading transactions…</div>
                        : transactions.isError || !data ? <div role="alert" className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 text-center text-sm"><p>Unable to load transactions.</p><Button variant="outline" onClick={() => void transactions.refetch()}>Try again</Button></div>
                        : rows.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center px-6 py-8 text-center">
                            <ReceiptText className="mb-3 size-8 text-[#7a8568]" strokeWidth={1.5} aria-hidden="true" />
                            <h2 className="text-base font-semibold">{data.total > 0 ? "No transactions on this page" : hasFilters ? "No matching transactions" : purchases ? "No purchases yet" : "No withdrawal requests yet"}</h2>
                            {data.total > 0 ? <Button className="mt-4" variant="outline" onClick={() => update("page", "")}>Go to first page</Button>
                                : hasFilters && <Button className="mt-4" variant="outline" onClick={clearFilters}>Clear filters</Button>}
                        </div> : (
                            <table className="w-full table-fixed text-sm">
                                <caption className="sr-only">{purchases ? "Platform purchases" : "Seller withdrawal requests"}</caption>
                                <thead className="border-b border-border bg-background/50"><tr>
                                    <th scope="col" className={`${th} w-[58%] md:w-auto`}>Transaction</th>
                                    <th scope="col" className={`${th} hidden md:table-cell md:w-[26%]`}>{purchases ? "Buyer" : "Seller"}</th>
                                    <th scope="col" className={`${th} hidden lg:table-cell lg:w-[14%]`}>Created</th>
                                    <th scope="col" className={`${th} text-right md:w-[21%] lg:w-[18%]`}>Amount<span className="md:hidden"> / Status</span></th>
                                    <th scope="col" className={`${th} hidden md:table-cell md:w-32`}>Status</th>
                                </tr></thead>
                                <tbody className="divide-y divide-border">{rows.map((transaction) => (
                                    <tr key={transaction.id} className="align-top transition-colors hover:bg-background/70 motion-reduce:transition-none">
                                        <th scope="row" className="px-4 py-4 text-left font-normal sm:px-6">
                                            <button type="button" aria-haspopup="dialog" onClick={(event) => {
                                                detailsButton.current = event.currentTarget;
                                                setSelected(transaction);
                                            }} className="inline-flex min-h-8 items-center gap-1 rounded-sm text-left font-semibold underline decoration-border underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                                                {titleOf(transaction)}<ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                            </button>
                                            {transaction.kind === "purchase" && <p className="text-xs text-muted-foreground">{METHOD_LABELS[transaction.method]} · {transaction.itemCount} {transaction.itemCount === 1 ? "item" : "items"}</p>}
                                            <p className="mt-1 truncate text-xs text-muted-foreground md:hidden">{accountName(transaction)}</p>
                                            <p className="mt-1 text-xs text-muted-foreground lg:hidden"><DateLabel value={transaction.createdAt} /></p>
                                        </th>
                                        <td className="hidden px-6 py-5 md:table-cell">
                                            <p className="truncate font-medium" title={accountName(transaction)}>{accountName(transaction)}</p>
                                            <p className="mt-1 truncate text-xs text-muted-foreground" title={transaction.account.email ?? undefined}>{transaction.account.email || `User #${transaction.account.userId}`}</p>
                                        </td>
                                        <td className="hidden px-6 py-5 text-xs text-muted-foreground lg:table-cell"><DateLabel value={transaction.createdAt} /></td>
                                        <td className="px-4 py-5 text-right sm:px-6">
                                            <p className="break-words text-xs font-semibold tabular-nums sm:text-sm">{amountOf(transaction)}</p>
                                            <div className="mt-2 md:hidden"><TransactionStatus transaction={transaction} /></div>
                                        </td>
                                        <td className="hidden px-6 py-5 md:table-cell"><TransactionStatus transaction={transaction} /></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        )}
                    {data && !transactions.isError && rows.length > 0 && (
                        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-6">
                            <p role="status" className="text-xs text-muted-foreground">{firstRow.toLocaleString()}–{(firstRow + rows.length - 1).toLocaleString()} of {data.total.toLocaleString()} {data.total === 1 ? "transaction" : "transactions"}</p>
                            {pageCount > 1 && <nav aria-label="Transaction pages" className="flex items-center gap-2">
                                <span className="mr-2 text-xs text-muted-foreground">Page {data.page} of {pageCount}</span>
                                <Button variant="outline" size="icon" className="size-11" aria-label="Previous page" disabled={data.page <= 1} onClick={() => update("page", data.page === 2 ? "" : String(data.page - 1))}><ChevronLeft aria-hidden="true" /></Button>
                                <Button variant="outline" size="icon" className="size-11" aria-label="Next page" disabled={data.page >= pageCount} onClick={() => update("page", String(data.page + 1))}><ChevronRight aria-hidden="true" /></Button>
                            </nav>}
                        </footer>
                    )}
                </section>
            </div>
            <TransactionDetails transaction={selected} close={() => setSelected(null)} restoreFocus={() => detailsButton.current?.focus()} />
        </main>
    );
}
