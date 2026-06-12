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
//                    + assets awaiting review
export async function getDashboardStats(req: Request, res: Response) {
    const [
        totalUsers,
        totalAssets,
        completedOrders,
        pendingApplications,
        pendingAssets,
    ] = await Promise.all([
        prisma.userProfile.count(),
        prisma.asset.count({ where: { status: "PUBLISHED" } }),
        prisma.order.findMany({
            where: { paymentStatus: "COMPLETED" },
            select: { totalAmount: true, currency: true },
        }),
        prisma.sellerApplication.count({ where: { status: "PENDING" } }),
        prisma.asset.count({ where: { status: "PENDING_REVIEW" } }),
    ]);

    let totalRevenue = 0;
    for (const order of completedOrders) {
        totalRevenue += await convert(
            Number(order.totalAmount),
            order.currency,
            REVENUE_BASE_CURRENCY,
        );
    }

    res.json({
        totalUsers,
        totalAssets,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        revenueCurrency: REVENUE_BASE_CURRENCY,
        pendingItems: pendingApplications + pendingAssets,
    });
}
