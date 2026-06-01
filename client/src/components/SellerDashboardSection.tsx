import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { DollarSign, ShoppingBag, Package, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "./ui/chart";
import { useSellerDashboard } from "../hooks/useSellerDashboard";
import { formatPrice } from "../lib/price";

const chartConfig = {
    revenue: {
        label: "Revenue",
        color: "var(--chart-1)",
    },
} satisfies ChartConfig;

// Turn "2026-05" into "May 2026" for the chart axis.
function formatMonth(month: string): string {
    const [year, m] = month.split("-");
    const date = new Date(Number(year), Number(m) - 1);
    return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function StatCard({
    title,
    value,
    icon,
}: {
    title: string;
    value: string;
    icon: React.ReactNode;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
                <span className="text-gray-400">{icon}</span>
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-bold">{value}</p>
            </CardContent>
        </Card>
    );
}

export default function SellerDashboardSection() {
    const { data, isLoading, isError } = useSellerDashboard();

    if (isLoading) {
        return <p className="text-sm text-gray-500">Loading dashboard…</p>;
    }
    if (isError || !data) {
        return <p className="text-sm text-red-600">Failed to load seller dashboard.</p>;
    }

    // Revenue is summed across orders; display in USD (sellers' default currency).
    const chartData = data.revenueSeries.map((p) => ({
        month: formatMonth(p.month),
        revenue: p.revenue,
    }));

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold">Seller Dashboard</h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Revenue"
                    value={formatPrice(data.revenue, "USD")}
                    icon={<DollarSign className="h-4 w-4" />}
                />
                <StatCard
                    title="Sales"
                    value={String(data.salesCount)}
                    icon={<ShoppingBag className="h-4 w-4" />}
                />
                <StatCard
                    title="Products"
                    value={String(data.productCount)}
                    icon={<Package className="h-4 w-4" />}
                />
                <StatCard
                    title="Pending Review"
                    value={String(data.pendingReviewCount)}
                    icon={<Clock className="h-4 w-4" />}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Monthly Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                    {chartData.length === 0 ? (
                        <p className="text-sm text-gray-500">No sales yet.</p>
                    ) : (
                        <ChartContainer config={chartConfig} className="h-[260px] w-full">
                            <BarChart data={chartData}>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
