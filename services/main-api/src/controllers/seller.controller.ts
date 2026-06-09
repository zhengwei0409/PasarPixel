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

// Total revenue (in USD) = sum of this seller's order items in COMPLETED orders.
async function getRevenue(sellerId: number): Promise<number> {
    const soldItems = await prisma.orderItem.findMany({
        where: {
            asset: { sellerId },
            order: { paymentStatus: "COMPLETED" },
        },
        select: { price: true, order: { select: { currency: true } } },
    });
    return sumItemsInUsd(soldItems);
}

// Available balance = revenue minus money already locked in withdrawals.
// REJECTED requests don't lock funds; everything else (PENDING/APPROVED/PAID) does.
async function getAvailableBalance(sellerId: number): Promise<number> {
    const revenue = await getRevenue(sellerId);
    const locked = await prisma.withdrawalRequest.aggregate({
        where: { sellerId, status: { not: "REJECTED" } },
        _sum: { amount: true },
    });
    return revenue - Number(locked._sum.amount ?? 0);
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
            order: { paymentStatus: "COMPLETED" },
        },
        select: {
            price: true,
            createdAt: true,
            order: { select: { currency: true } },
        },
    });

    const revenue = await sumItemsInUsd(soldItems);
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

    const availableBalance = await getAvailableBalance(sellerId);

    res.json({
        revenue,
        salesCount,
        productCount,
        pendingReviewCount,
        productsByStatus,
        revenueSeries,
        availableBalance,
    });
}

// GET /seller/withdrawals — the logged-in seller's withdrawal requests.
export async function getMyWithdrawals(req: Request, res: Response) {
    const sellerId = req.user!.userId;

    const withdrawals = await prisma.withdrawalRequest.findMany({
        where: { sellerId },
        orderBy: { createdAt: "desc" },
    });

    const availableBalance = await getAvailableBalance(sellerId);

    res.json({ withdrawals, availableBalance });
}

// POST /seller/withdrawals — request a withdrawal of { amount }.
// Rejects amounts that exceed the seller's available balance so they can't
// withdraw money they haven't earned or double-withdraw the same funds.
export async function requestWithdrawal(req: Request, res: Response) {
    const sellerId = req.user!.userId;
    const amount = Number(req.body?.amount);

    if (!isFinite(amount) || amount <= 0) {
        res.status(400).json({ error: "amount must be a positive number" });
        return;
    }

    const availableBalance = await getAvailableBalance(sellerId);
    if (amount > availableBalance) {
        res.status(400).json({
            error: "amount exceeds available balance",
            availableBalance,
        });
        return;
    }

    const withdrawal = await prisma.withdrawalRequest.create({
        data: { sellerId, amount },
    });

    res.status(201).json({
        withdrawal,
        availableBalance: availableBalance - amount,
    });
}
