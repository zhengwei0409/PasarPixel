import { Bar, BarChart, CartesianGrid, Cell, XAxis } from "recharts";
import { Banknote, ShoppingBag, Package, Clock, ChartNoAxesColumn } from "lucide-react";
import { Card, CardContent, CardHeader } from "./ui/card";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "./ui/chart";
import { useSellerDashboard } from "../hooks/useSellerDashboard";
import { formatPrice, convertFiat } from "../lib/price";
import { useCurrencyStore } from "../stores/currencyStore";
import WithdrawalSection from "./WithdrawalSection";
import SellerRecentOrdersSection from "./SellerRecentOrdersSection";

const chartConfig = {
    revenue: { label: "Revenue", color: "#7a8568" },
} satisfies ChartConfig;

function formatMonth(month: string): string {
    const [year, m] = month.split("-");
    return new Date(Number(year), Number(m) - 1).toLocaleString("en-US", {
        month: "short", year: "numeric",
    });
}

function StatCard({ title, value, description, icon }: {
    title: string;
    value: string;
    description: string;
    icon: React.ReactNode;
}) {
    return (
        <Card className="gap-3 rounded-xl py-5 ring-border">
            <CardHeader className="flex flex-row items-center justify-between gap-3 px-5">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>
                <span className="text-[#7a8568]" aria-hidden="true">{icon}</span>
            </CardHeader>
            <CardContent className="px-5">
                <p className="break-words text-2xl font-semibold tracking-tight tabular-nums sm:text-[28px]">{value}</p>
                <p className="mt-2 text-xs text-muted-foreground">{description}</p>
            </CardContent>
        </Card>
    );
}

export default function SellerDashboardSection() {
    const { data, isLoading, isError } = useSellerDashboard();
    const displayCurrency = useCurrencyStore((s) => s.displayCurrency);

    if (isLoading) {
        return <p role="status" className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading dashboard…</p>;
    }
    if (isError || !data) {
        return <p role="alert" className="rounded-xl border border-border bg-card p-6 text-sm text-red-600">Failed to load seller dashboard.</p>;
    }

    const chartData = data.revenueSeries.map((p) => ({
        month: formatMonth(p.month),
        revenue: convertFiat(p.revenue, "USD", displayCurrency),
    }));

    return (
        <section aria-label="Seller performance" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="Total revenue" value={formatPrice(data.revenue, "USD", displayCurrency, { zeroAsFree: false })} description="Earnings from your asset sales" icon={<Banknote className="size-5" />} />
                <StatCard title="Total sales" value={data.salesCount.toLocaleString()} description="Sales across your store" icon={<ShoppingBag className="size-5" />} />
                <StatCard title="Products" value={data.productCount.toLocaleString()} description="Assets in your inventory" icon={<Package className="size-5" />} />
                <StatCard title="Pending review" value={data.pendingReviewCount.toLocaleString()} description="Assets awaiting approval" icon={<Clock className="size-5" />} />
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_350px]">
                <div className="min-w-0 space-y-6">
                    <Card className="min-w-0 gap-6 rounded-xl py-6 ring-border">
                        <CardHeader className="px-6">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold tracking-tight">Revenue analytics</h2>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Monthly earnings from your creative assets.</p>
                                </div>
                                <span className="rounded-md bg-secondary px-3 py-1.5 text-[10px] font-medium text-secondary-foreground">Monthly</span>
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 sm:px-6">
                            {chartData.length === 0 ? (
                                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg bg-background px-6 text-center">
                                    <ChartNoAxesColumn className="mb-4 size-8 text-[#7a8568]" aria-hidden="true" />
                                    <p className="text-sm font-medium">No sales yet</p>
                                    <p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">Your monthly revenue will appear here once you make your first sale.</p>
                                </div>
                            ) : (
                                <ChartContainer config={chartConfig} className="h-[300px] w-full sm:h-[340px]">
                                    <BarChart accessibilityLayer data={chartData} margin={{ top: 16, right: 0, bottom: 8, left: 0 }}>
                                        <CartesianGrid vertical={false} strokeDasharray="3 5" />
                                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={12} minTickGap={20} tick={{ fontSize: 10 }} />
                                        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatPrice(Number(value), displayCurrency, displayCurrency, { zeroAsFree: false })} />} />
                                        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[5, 5, 0, 0]} maxBarSize={80}>
                                            {chartData.map((point, index) => <Cell key={point.month} fill={index === chartData.length - 1 ? "#657152" : "#d8dfca"} />)}
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>
                    <SellerRecentOrdersSection />
                </div>
                <WithdrawalSection />
            </div>
        </section>
    );
}
