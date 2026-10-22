import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, ArrowRight, Banknote, ChartNoAxesColumn, ClipboardCheck, Clock3, Flag, Package, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, XAxis, YAxis } from "recharts";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { useDashboardStats } from "../hooks/useDashboardStats";
import { useRoleLogs } from "../hooks/useRoleLogs";
import { useAssetReviewLogs } from "../hooks/useAssetReviewLogs";
import { useCurrencyStore } from "../stores/currencyStore";
import { convertFiat, formatLamportsSol, formatPrice } from "../lib/price";

const chartConfig = {
    users: { label: "New users", color: "#7a8568" },
    revenue: { label: "Revenue", color: "#657152" },
};

function monthLabel(month: string) {
    const [year, number] = month.split("-");
    return new Date(Number(year), Number(number) - 1).toLocaleString("en-US", { month: "short" });
}

function RecentSystemLogs() {
    const roles = useRoleLogs();
    const assets = useAssetReviewLogs();
    const [showAll, setShowAll] = useState(false);
    const logs = [
        ...(roles.data ?? []).map((log) => ({
            id: `role-${log.id}`, action: `${log.role} ${log.action === "GRANT" ? "granted" : "revoked"}`,
            admin: log.admin.name ?? log.admin.email ?? `User #${log.admin.userId}`,
            subject: log.targetUser.name ?? log.targetUser.email ?? `User #${log.targetUser.userId}`,
            createdAt: log.createdAt, status: log.action === "GRANT" ? "Granted" : "Revoked", positive: log.action === "GRANT", reason: log.reason,
        })),
        ...(assets.data ?? []).map((log) => ({
            id: `asset-${log.id}`, action: `Asset ${log.action === "APPROVE" ? "approved" : "rejected"}`,
            admin: log.admin.name ?? log.admin.email ?? `User #${log.admin.userId}`,
            subject: log.asset.title ?? `Asset #${log.asset.id}`,
            createdAt: log.createdAt, status: log.action === "APPROVE" ? "Approved" : "Rejected", positive: log.action === "APPROVE", reason: log.reason,
        })),
    ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const busy = roles.isFetching || assets.isFetching;

    return (
        <Card className="gap-0 overflow-hidden rounded-xl py-0 ring-border">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-6">
                <div>
                    <h2 className="text-base font-semibold tracking-tight">Recent system logs</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Seller access changes and marketplace asset reviews.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => { void roles.refetch(); void assets.refetch(); }} aria-label="Refresh system logs">
                        <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
                    </Button>
                    {logs.length > 5 && <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>{showAll ? "Show recent" : "View all logs"}<ArrowRight className="size-3.5" /></Button>}
                </div>
            </CardHeader>
            <CardContent className="px-0">
                {(roles.isError || assets.isError) && <p role="alert" className="px-6 py-4 text-sm text-red-700">Some activity could not be loaded. Refresh to try again.</p>}
                {roles.isLoading || assets.isLoading ? <p role="status" className="p-6 text-sm text-muted-foreground">Loading system activity…</p> : logs.length === 0 ? (
                    <div className="flex flex-col items-center px-6 py-12 text-center"><ShieldCheck className="mb-3 size-7 text-[#7a8568]" /><p className="text-sm font-medium">No system activity yet</p><p className="mt-2 text-xs text-muted-foreground">Admin actions will appear here as you review your marketplace.</p></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-secondary/60 text-muted-foreground"><tr>{["Action", "Admin", "Subject", "Timestamp", "Status", "Reason"].map((label) => <th key={label} className="whitespace-nowrap px-6 py-3 font-medium">{label}</th>)}</tr></thead>
                            <tbody>{(showAll ? logs : logs.slice(0, 5)).map((log) => <tr key={log.id} className="border-t border-border/60 hover:bg-background/60">
                                <td className="whitespace-nowrap px-6 py-4 font-medium">{log.action}</td><td className="px-6 py-4">{log.admin}</td><td className="min-w-40 px-6 py-4">{log.subject}</td>
                                <td className="whitespace-nowrap px-6 py-4 text-muted-foreground"><time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></td>
                                <td className="px-6 py-4"><span className={`rounded px-2 py-1 text-[10px] font-medium ${log.positive ? "bg-[#e3e8d8] text-[#425137]" : "bg-red-50 text-red-700"}`}>{log.status}</span></td><td className="min-w-40 px-6 py-4 text-muted-foreground">{log.reason ?? "—"}</td>
                            </tr>)}</tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function AdminDashboardSection() {
    const { data, isLoading, isError, refetch, isFetching } = useDashboardStats();
    const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
    const [months, setMonths] = useState("6");
    const money = (value: number) => formatPrice(value, data?.revenueCurrency ?? "USD", displayCurrency, { zeroAsFree: false });
    const chartData = (data?.monthlyTrends ?? []).slice(-Number(months)).map((point) => ({ ...point, label: monthLabel(point.month), revenue: convertFiat(point.revenue, data?.revenueCurrency ?? "USD", displayCurrency) }));

    function exportReport() {
        if (!data) return;
        const rows = [
            ["Metric", "Value", "Currency"], ["Total registered users", data.totalUsers, ""], ["Published assets", data.totalAssets, ""],
            ["Platform revenue (completed fiat order volume)", data.totalRevenue, data.revenueCurrency],
            ["Pending seller applications", data.pendingApplications, ""], ["Pending asset reviews", data.pendingAssets, ""], ["Pending reports", data.pendingReports, ""],
            ["SOL volume (lamports, Devnet)", data.solVolumeLamports ?? "0", "SOL lamports"], ["SOL commission (lamports, Devnet)", data.solCommissionLamports ?? "0", "SOL lamports"],
            [], ["Month (UTC)", "New users", `Revenue (${data.revenueCurrency})`],
            ...(data.monthlyTrends ?? []).slice(-Number(months)).map((point) => [point.month, point.users, point.revenue]),
        ];
        const blob = new Blob([rows.map((row) => row.join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `pasarpixel-report-${new Date().toISOString().slice(0, 10)}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    return (
        <section aria-label="Admin overview" className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-5 pb-2">
                <div><p className="mb-2 text-[10px] font-medium tracking-[0.2em] text-muted-foreground">YOUR MARKETPLACE AT A GLANCE</p><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Executive overview</h1><p className="mt-2 text-xs leading-5 text-muted-foreground">Monitor platform performance and keep your creative marketplace moving.</p></div>
                <Button className="h-11 gap-2 px-5" onClick={exportReport} disabled={!data}><ArrowDownToLine className="size-4" />Export report <span className="text-primary-foreground/65">(CSV)</span></Button>
            </header>

            <nav aria-label="Marketplace management" className="space-y-3">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Manage marketplace</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    {[
                        { to: "/admin/sellers", title: "Sellers", description: "Manage seller access and marketplace stores.", icon: ShieldCheck },
                        { to: "/admin/reports", title: "Reported listings", description: data?.pendingReports !== undefined ? `${data.pendingReports.toLocaleString()} pending reports to review.` : "Review reports and moderate listings.", icon: Flag },
                    ].map(({ to, title, description, icon: Icon }) => (
                        <Link key={to} to={to} className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-[#657152]"><Icon className="size-5" aria-hidden="true" /></span>
                            <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>
                            <ArrowRight className="size-4 shrink-0 text-[#657152] transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </Link>
                    ))}
                </div>
            </nav>

            {isLoading ? <p role="status" className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading marketplace overview…</p> : isError || !data ? <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-6 text-sm"><p>Unable to load marketplace statistics.</p><Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>Try again</Button></div> : <>
                <div className="grid gap-4 sm:grid-cols-3">
                    {[
                        { title: "Total registered users", value: data.totalUsers.toLocaleString(), description: "Creators across the marketplace", icon: Users, to: "/admin/users", action: "Manage users" },
                        { title: "Total published assets", value: data.totalAssets.toLocaleString(), description: "Live and ready to discover", icon: Package, to: "/admin/assets", action: "View all assets" },
                        { title: "Platform revenue", value: money(data.totalRevenue), description: "Completed fiat order volume · all time", icon: Banknote, to: null, action: null },
                    ].map(({ title, value, description, icon: Icon, to, action }) => <Card key={title} className="gap-4 rounded-xl py-5 ring-border"><CardHeader className="px-5"><span className="flex size-10 items-center justify-center rounded-lg bg-accent text-[#657152]"><Icon className="size-5" aria-hidden="true" /></span></CardHeader><CardContent className="px-5"><h2 className="text-xs text-muted-foreground">{title}</h2><p className="mt-2 break-words text-3xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-2 text-[11px] text-muted-foreground">{description}</p>{to && <Link to={to} className="mt-4 inline-flex items-center gap-2 rounded text-xs font-medium text-[#555e49] hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{action}<ArrowRight className="size-3.5" aria-hidden="true" /></Link>}</CardContent></Card>)}
                </div>

                {(data.pendingApplications === undefined || data.pendingAssets === undefined || !data.monthlyTrends) && <p role="status" className="rounded-lg border border-border bg-secondary/50 px-4 py-3 text-xs text-muted-foreground">Detailed queue counts and analytics are temporarily unavailable. You can still open the review queues below.</p>}
                <div className="grid gap-4 md:grid-cols-2">
                    {[
                        { title: "Pending seller applications", description: "Review credentials for new store owners.", count: data.pendingApplications, to: "/admin/applications", action: "Review applications", icon: Users },
                        { title: "Pending asset reviews", description: "Keep quality at the heart of your marketplace.", count: data.pendingAssets, to: "/admin/assets/pending", action: "View review queue", icon: ClipboardCheck },
                    ].map(({ title, description, count, to, action, icon: Icon }) => <Link key={title} to={to} className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-[#eceee7] p-5 transition-colors hover:bg-[#e3e8d8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-6"><div><span className="mb-4 flex size-9 items-center justify-center rounded-lg bg-white/70 text-[#657152]"><Icon className="size-4" /></span><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{description}</p></div><div className="shrink-0 text-right"><p className="text-4xl font-semibold tracking-tight text-[#555e49] tabular-nums">{count?.toLocaleString() ?? "—"}</p><span className="mt-3 flex items-center justify-end gap-1 text-[10px] font-medium text-[#555e49] sm:text-xs">{action}<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" /></span></div></Link>)}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2"><div className="flex items-center gap-2"><ChartNoAxesColumn className="size-4 text-[#7a8568]" /><h2 className="text-sm font-semibold">Marketplace analytics</h2></div><div className="flex items-center gap-3">
                    <span id="admin-chart-period-label" className="text-xs text-muted-foreground">Chart period</span>
                    <Select value={months} onValueChange={setMonths}>
                        <SelectTrigger aria-labelledby="admin-chart-period-label" className="w-40 gap-4 border-border bg-card px-3 text-xs font-medium text-foreground data-[size=default]:h-9 focus-visible:ring-2 focus-visible:ring-ring/25">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" align="end" className="admin-dashboard-theme border border-border bg-popover p-1 text-popover-foreground">
                            <SelectItem value="6" className="text-xs">Last 6 months</SelectItem>
                            <SelectItem value="3" className="text-xs">Last 3 months</SelectItem>
                        </SelectContent>
                    </Select>
                </div></div>
                <div className="grid gap-6 lg:grid-cols-2">
                    {(["users", "revenue"] as const).map((metric) => <Card key={metric} className="min-w-0 gap-6 rounded-xl py-6 ring-border"><CardHeader className="px-6"><h3 className="text-base font-semibold tracking-tight">{metric === "users" ? "User growth trend" : "Revenue performance"}</h3><p className="text-xs leading-5 text-muted-foreground">{metric === "users" ? "New registrations each month." : `Monthly completed fiat order volume in ${displayCurrency}.`}</p></CardHeader><CardContent className="px-4 sm:px-6">
                        {!chartData.some((point) => point[metric] > 0) ? <div className="flex h-[260px] flex-col items-center justify-center rounded-lg bg-background px-6 text-center"><ChartNoAxesColumn className="mb-3 size-7 text-[#7a8568]" /><p className="text-sm font-medium">{!data.monthlyTrends ? "Analytics temporarily unavailable" : metric === "users" ? "No registrations in this period" : "No revenue in this period"}</p><p className="mt-2 text-xs text-muted-foreground">{!data.monthlyTrends ? "Please try again later." : "Activity will appear here as your marketplace grows."}</p></div> : <ChartContainer config={chartConfig} className="h-[260px] w-full">
                            {metric === "users" ? <BarChart accessibilityLayer data={chartData} margin={{ top: 15, left: -25, right: 8, bottom: 8 }}><CartesianGrid vertical={false} strokeDasharray="3 5" /><XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={12} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="users" radius={[4, 4, 0, 0]} maxBarSize={64}>{chartData.map((point, index) => <Cell key={point.month} fill={index === chartData.length - 1 ? "#657152" : "#d8dfca"} />)}</Bar></BarChart> : <LineChart accessibilityLayer data={chartData} margin={{ top: 15, left: 8, right: 16, bottom: 8 }}><CartesianGrid vertical={false} strokeDasharray="3 5" /><XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={12} tick={{ fontSize: 10 }} /><ChartTooltip content={<ChartTooltipContent formatter={(value) => formatPrice(Number(value), displayCurrency, displayCurrency, { zeroAsFree: false })} />} /><Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2.5} dot={{ r: 3, fill: "#657152", strokeWidth: 0 }} activeDot={{ r: 5 }} /></LineChart>}
                        </ChartContainer>}
                    </CardContent></Card>)}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 px-5 py-4 text-xs"><div className="flex items-start gap-3"><Banknote className="mt-0.5 size-4 shrink-0 text-[#7a8568]" /><div><p className="font-medium">SOL volume · Devnet: {formatLamportsSol(data.solVolumeLamports ?? "0")}</p><p className="mt-1 text-muted-foreground">Platform commission: {formatLamportsSol(data.solCommissionLamports ?? "0")} · Tracked separately from fiat revenue.</p></div></div><span className="flex items-center gap-1.5 text-muted-foreground"><Clock3 className="size-3.5" />{data.pendingItems.toLocaleString()} pending actions</span></div>
            </>}
            <RecentSystemLogs />

        </section>
    );
}
