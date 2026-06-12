import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// POST /reports — a signed-in user reports a published asset for review by
// admins. Stored with status PENDING; admins review it in a later step.
export async function createReport(req: Request, res: Response) {
    const userId = req.user!.userId;

    const { assetId, reason } = req.body;
    if (!Number.isInteger(assetId)) {
        res.status(400).json({ error: "assetId must be an integer" });
        return;
    }
    if (typeof reason !== "string" || reason.trim().length === 0) {
        res.status(400).json({ error: "reason is required" });
        return;
    }

    // Only published, live assets can be reported.
    const asset = await prisma.asset.findFirst({
        where: { id: assetId, status: "PUBLISHED", isDeleted: false },
        select: { sellerId: true },
    });
    if (!asset) {
        res.status(404).json({ error: "Asset not found" });
        return;
    }
    if (asset.sellerId === userId) {
        res.status(403).json({ error: "You cannot report your own asset" });
        return;
    }

    const report = await prisma.report.create({
        data: { userId, assetId, reason: reason.trim() },
    });

    res.status(201).json(report);
}
