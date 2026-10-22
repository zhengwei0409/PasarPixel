import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { convert } from "../lib/currency";

// The single currency every revenue figure is normalised to before summing.
// Orders are stored in mixed currencies (USD/MYR), so we convert each to USD
// at the current rate — adding mixed-currency amounts directly is meaningless.
// The frontend then re-displays this USD total in whatever the admin toggles.
const REVENUE_BASE_CURRENCY = "USD";

// Admin-only: aggregate platform-wide stats for the admin dashboard cards.
//   - totalUsers:    every registered user profile
//   - totalAssets:   assets that are live on the marketplace (PUBLISHED)
//   - totalRevenue:  COMPLETED order totals, each converted to USD, then summed
//   - pendingItems:  things waiting on an admin = pending seller applications
//                    + assets awaiting review + unresolved reports
export async function getDashboardStats(req: Request, res: Response) {
    const now = new Date();
    const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const monthlyTrends = Array.from({ length: 6 }, (_, index) => ({
        month: new Date(Date.UTC(trendStart.getUTCFullYear(), trendStart.getUTCMonth() + index, 1)).toISOString().slice(0, 7),
        users: 0,
        revenue: 0,
    }));
    const [
        totalUsers,
        totalAssets,
        completedOrders,
        pendingApplications,
        pendingAssets,
        pendingReports,
        recentUsers,
    ] = await Promise.all([
        prisma.userProfile.count(),
        prisma.asset.count({ where: { status: "PUBLISHED" } }),
        prisma.order.findMany({
            where: { paymentStatus: "COMPLETED", paymentMethod: "STRIPE" },
            select: { totalAmount: true, currency: true, createdAt: true },
        }),
        prisma.sellerApplication.count({ where: { status: "PENDING" } }),
        prisma.asset.count({ where: { status: "PENDING_REVIEW" } }),
        prisma.report.count({ where: { status: "PENDING" } }),
        prisma.userProfile.findMany({
            where: { createdAt: { gte: trendStart } },
            select: { createdAt: true },
        }),
    ]);

    let totalRevenue = 0;
    for (const order of completedOrders) {
        const revenue = await convert(
            Number(order.totalAmount),
            order.currency,
            REVENUE_BASE_CURRENCY,
        );
        totalRevenue += revenue;
        const point = monthlyTrends.find((item) => item.month === order.createdAt.toISOString().slice(0, 7));
        if (point) point.revenue += revenue;
    }
    for (const user of recentUsers) {
        const point = monthlyTrends.find((item) => item.month === user.createdAt.toISOString().slice(0, 7));
        if (point) point.users += 1;
    }

    const solOrders = await prisma.order.findMany({ where: { paymentStatus: "COMPLETED", paymentMethod: "SOL" },
        select: { totalLamports: true, orderItems: { select: { commissionLamports: true } } } });
    const solVolumeLamports = solOrders.reduce((sum, order) => sum + BigInt(order.totalLamports ?? "0"), 0n);
    const solCommissionLamports = solOrders.reduce((sum, order) => sum + (order.orderItems ?? []).reduce((s, item) => s + BigInt(item.commissionLamports ?? "0"), 0n), 0n);
    res.json({
        totalUsers,
        totalAssets,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        revenueCurrency: REVENUE_BASE_CURRENCY,
        solVolumeLamports: solVolumeLamports.toString(), solCommissionLamports: solCommissionLamports.toString(),
        pendingItems: pendingApplications + pendingAssets + pendingReports,
        pendingApplications,
        pendingAssets,
        pendingReports,
        monthlyTrends: monthlyTrends.map((point) => ({ ...point, revenue: Math.round(point.revenue * 100) / 100 })),
    });
}
