import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// Admin-only: list asset approve/reject history, newest first.
// Each log stores only IDs, so we look up the acting admin's name/email and
// the reviewed asset's title and attach them for display.
export async function listAssetReviewLogs(req: Request, res: Response) {
    const logs = await prisma.assetReviewLog.findMany({
        orderBy: { createdAt: "desc" },
    });

    const adminIds = [...new Set(logs.map((log) => log.adminUserId))];
    const assetIds = [...new Set(logs.map((log) => log.assetId))];

    const admins = await prisma.userProfile.findMany({
        where: { userId: { in: adminIds } },
        select: { userId: true, name: true, email: true },
    });
    const assets = await prisma.asset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true, title: true },
    });

    const adminByUserId = new Map(admins.map((a) => [a.userId, a]));
    const assetById = new Map(assets.map((a) => [a.id, a]));

    const result = logs.map((log) => ({
        id: log.id,
        action: log.action,
        reason: log.reason,
        createdAt: log.createdAt,
        asset: assetById.get(log.assetId) ?? { id: log.assetId, title: null },
        admin: adminByUserId.get(log.adminUserId) ?? {
            userId: log.adminUserId,
            name: null,
            email: null,
        },
    }));

    res.json(result);
}
