import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// GET /seller/dashboard
// Aggregated stats for the logged-in seller's dashboard (FR-2.6):
// revenue, sales count, product counts by status, and a monthly revenue
// series for the chart. Read-only — no DB schema changes.
export async function getDashboard(req: Request, res: Response) {
    const sellerId = req.user!.userId;

    // Order items for this seller's assets that belong to a COMPLETED order.
    // Those are the only ones that count as real, paid sales.
    const soldItems = await prisma.orderItem.findMany({
        where: {
            asset: { sellerId },
            order: { paymentStatus: "COMPLETED" },
        },
        select: {
            price: true,
            createdAt: true,
        },
    });

    const revenue = soldItems.reduce((sum, item) => sum + Number(item.price), 0);
    const salesCount = soldItems.length;

    // Count this seller's listings grouped by status (excludes soft-deleted).
    const grouped = await prisma.asset.groupBy({
        by: ["status"],
        where: { sellerId, isDeleted: false },
        _count: { _all: true },
    });

    const productsByStatus: Record<string, number> = {};
    let productCount = 0;
    for (const row of grouped) {
        const count = row._count._all;
        productsByStatus[row.status] = count;
        productCount += count;
    }
    const pendingReviewCount = productsByStatus["PENDING_REVIEW"] ?? 0;

    // Monthly revenue series for the chart, e.g. { month: "2026-05", revenue: 120 }.
    const revenueByMonth = new Map<string, number>();
    for (const item of soldItems) {
        const month = item.createdAt.toISOString().slice(0, 7); // YYYY-MM
        revenueByMonth.set(month, (revenueByMonth.get(month) ?? 0) + Number(item.price));
    }
    const revenueSeries = Array.from(revenueByMonth.entries())
        .map(([month, value]) => ({ month, revenue: value }))
        .sort((a, b) => a.month.localeCompare(b.month));

    res.json({
        revenue,
        salesCount,
        productCount,
        pendingReviewCount,
        productsByStatus,
        revenueSeries,
    });
}
