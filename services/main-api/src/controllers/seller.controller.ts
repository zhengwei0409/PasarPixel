import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { convert } from "../lib/currency";

// Order items store price in the currency the buyer paid in (Order.currency),
// not always USD. The dashboard reports revenue in USD (the frontend converts
// it to the user's display currency), so each item must be converted to USD
// before summing — otherwise an RM order is counted as if it were USD.
async function sumItemsInUsd(
    items: { price: unknown; order: { currency: string } }[],
): Promise<number> {
    let total = 0;
    for (const item of items) {
        total += await convert(Number(item.price), item.order.currency, "USD");
    }
    return total;
}

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
            order: { paymentStatus: "COMPLETED", paymentMethod: "STRIPE" },
        },
        select: {
            price: true,
            createdAt: true,
            order: { select: { currency: true } },
        },
    });

    const solItems = await prisma.orderItem.findMany({ where: { asset: { sellerId }, order: { paymentStatus: "COMPLETED", paymentMethod: "SOL" } },
        select: { priceLamports: true, commissionLamports: true } });
    const solRevenueLamports = solItems.reduce((sum, item) => sum + BigInt(item.priceLamports ?? "0") - BigInt(item.commissionLamports ?? "0"), 0n);
    const solCommissionLamports = solItems.reduce((sum, item) => sum + BigInt(item.commissionLamports ?? "0"), 0n);
    const solSalesCount = solItems.filter(item => item.priceLamports !== null && item.priceLamports !== undefined).length;
    const revenue = await sumItemsInUsd(soldItems);
    const salesCount = soldItems.length + solSalesCount;

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
    // Revenue is in USD; convert each item from its order's currency first.
    const revenueByMonth = new Map<string, number>();
    for (const item of soldItems) {
        const month = item.createdAt.toISOString().slice(0, 7); // YYYY-MM
        const priceUsd = await convert(Number(item.price), item.order.currency, "USD");
        revenueByMonth.set(month, (revenueByMonth.get(month) ?? 0) + priceUsd);
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
        solRevenueLamports: solRevenueLamports.toString(), solCommissionLamports: solCommissionLamports.toString(), solSalesCount,
    });
}

// GET /seller/orders — latest asset purchases belonging to this seller only.
export async function getRecentOrders(req: Request, res: Response) {
    const items = await prisma.orderItem.findMany({
        where: { asset: { sellerId: req.user!.userId } },
        orderBy: [{ order: { createdAt: "desc" } }, { id: "desc" }],
        take: 10,
        select: {
            id: true,
            orderId: true,
            licenseType: true,
            price: true,
            priceLamports: true,
            commissionLamports: true,
            asset: { select: { title: true } },
            order: { select: {
                createdAt: true,
                currency: true,
                paymentStatus: true,
                paymentMethod: true,
                buyer: { select: { name: true } },
            } },
        },
    });
    res.json({ items: items.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        product: item.asset.title,
        buyerName: item.order.buyer.name,
        licenseType: item.licenseType,
        amount: String(item.price),
        priceLamports: item.priceLamports,
        commissionLamports: item.commissionLamports,
        paymentMethod: item.order.paymentMethod,
        currency: item.order.currency,
        paymentStatus: item.order.paymentStatus,
        createdAt: item.order.createdAt,
    })) });
}
