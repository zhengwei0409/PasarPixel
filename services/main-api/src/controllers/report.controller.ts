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

// GET /reports — admin-only list of all reports, newest first. Each report
// stores only IDs, so we look up the reporter's name/email and the reported
// asset's title (plus its seller) and attach them for display.
export async function listReports(req: Request, res: Response) {
    const reports = await prisma.report.findMany({
        orderBy: { createdAt: "desc" },
    });

    const reporterIds = [...new Set(reports.map((r) => r.userId))];
    const assetIds = [...new Set(reports.map((r) => r.assetId))];

    const reporters = await prisma.userProfile.findMany({
        where: { userId: { in: reporterIds } },
        select: { userId: true, name: true, email: true },
    });
    const assets = await prisma.asset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true, title: true, status: true, sellerId: true },
    });

    const reporterByUserId = new Map(reporters.map((r) => [r.userId, r]));
    const assetById = new Map(assets.map((a) => [a.id, a]));

    const result = reports.map((report) => ({
        id: report.id,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        asset: assetById.get(report.assetId) ?? {
            id: report.assetId,
            title: null,
            status: null,
            sellerId: null,
        },
        reporter: reporterByUserId.get(report.userId) ?? {
            userId: report.userId,
            name: null,
            email: null,
        },
    }));

    res.json(result);
}
