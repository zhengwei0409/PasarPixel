import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// Admin-only: aggregate platform-wide stats for the admin dashboard cards.
//   - totalUsers:    every registered user profile
//   - totalAssets:   assets that are live on the marketplace (PUBLISHED)
//   - totalRevenue:  sum of all COMPLETED order totals
//   - pendingItems:  things waiting on an admin = pending seller applications
//                    + assets awaiting review
export async function getDashboardStats(req: Request, res: Response) {
    const [
        totalUsers,
        totalAssets,
        revenue,
        pendingApplications,
        pendingAssets,
    ] = await Promise.all([
        prisma.userProfile.count(),
        prisma.asset.count({ where: { status: "PUBLISHED" } }),
        prisma.order.aggregate({
            _sum: { totalAmount: true },
            where: { paymentStatus: "COMPLETED" },
        }),
        prisma.sellerApplication.count({ where: { status: "PENDING" } }),
        prisma.asset.count({ where: { status: "PENDING_REVIEW" } }),
    ]);

    res.json({
        totalUsers,
        totalAssets,
        totalRevenue: revenue._sum.totalAmount ?? 0,
        pendingItems: pendingApplications + pendingAssets,
    });
}
