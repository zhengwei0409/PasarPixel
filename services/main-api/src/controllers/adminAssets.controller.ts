import { Request, Response } from "express";
import { AssetStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { publishAssetRemoved } from "../lib/publisher";

// Admin inventory includes every lifecycle status, but excludes deleted listings.
export async function listAdminAssets(req: Request, res: Response) {
    const status = req.query.status;
    const search = req.query.search;
    const page = Number(req.query.page ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000
        || (status !== undefined && (typeof status !== "string" || !Object.values(AssetStatus).includes(status as AssetStatus)))
        || (search !== undefined && (typeof search !== "string" || search.length > 200))) {
        res.status(400).json({ error: "Invalid asset filters" });
        return;
    }
    const pageSize = 20;
    const where: Prisma.AssetWhereInput = {
        isDeleted: false,
        ...(status ? { status: status as AssetStatus } : {}),
        ...(typeof search === "string" && search.trim() ? {
            OR: [
                { title: { contains: search.trim(), mode: "insensitive" } },
                { seller: { name: { contains: search.trim(), mode: "insensitive" } } },
            ],
        } : {}),
    };
    const [items, total] = await Promise.all([
        prisma.asset.findMany({
            where,
            select: { id: true, title: true, status: true, category: true, listingType: true, createdAt: true, updatedAt: true, seller: { select: { userId: true, name: true } } },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.asset.count({ where }),
    ]);
    res.json({ items, total, page, pageSize });
}

// Hide a published listing while retaining its admin record and moderation reason.
export async function takeDownAdminAsset(req: Request, res: Response) {
    const assetId = Number(req.params.id);
    const reason = req.body?.reason;
    if (!Number.isSafeInteger(assetId) || assetId < 1) {
        res.status(400).json({ error: "Invalid asset id" });
        return;
    }
    if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 2000) {
        res.status(400).json({ error: "A takedown reason of 1–2000 characters is required" });
        return;
    }
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.isDeleted) {
        res.status(404).json({ error: "Asset not found" });
        return;
    }
    if (asset.status !== "PUBLISHED") {
        res.status(409).json({ error: "Only published assets can be taken down" });
        return;
    }
    const updated = await prisma.asset.updateMany({
        where: { id: assetId, status: "PUBLISHED", isDeleted: false },
        data: { status: "TAKEN_DOWN", rejectionReason: reason.trim() },
    });
    if (updated.count !== 1) {
        res.status(409).json({ error: "The asset status has changed. Refresh and try again." });
        return;
    }
    await publishAssetRemoved({ sellerId: asset.sellerId, assetId, assetTitle: asset.title, reason: reason.trim() });
    res.json({ id: assetId, status: "TAKEN_DOWN", rejectionReason: reason.trim() });
}
