import { Users, Package, DollarSign, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useDashboardStats } from "../hooks/useDashboardStats";

// One stats card: a label, an icon, and the big number underneath.
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
                <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
                <span className="text-gray-400">{icon}</span>
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-bold">{value}</p>
            </CardContent>
        </Card>
    );
}

export default function DashboardStatsSection() {
    const { data, isLoading, isError } = useDashboardStats();

    if (isLoading) {
        return <p className="text-sm text-gray-500">Loading stats…</p>;
    }

    if (isError || !data) {
        return <p className="text-sm text-red-600">Failed to load dashboard stats.</p>;
    }

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
                title="Total Users"
                value={data.totalUsers.toLocaleString()}
                icon={<Users className="h-4 w-4" />}
            />
            <StatCard
                title="Assets Listed"
                value={data.totalAssets.toLocaleString()}
                icon={<Package className="h-4 w-4" />}
            />
            <StatCard
                title="Platform Revenue"
                value={`USD ${data.totalRevenue.toLocaleString()}`}
                icon={<DollarSign className="h-4 w-4" />}
            />
            <StatCard
                title="Pending Actions"
                value={data.pendingItems.toLocaleString()}
                icon={<ClipboardList className="h-4 w-4" />}
            />
        </div>
    );
}
