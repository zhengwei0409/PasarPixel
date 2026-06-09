import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getPresignedUploadUrl, deleteObject, extractKeyFromUrl } from "../lib/s3";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Which shop image a presigned upload / apply targets. Keeps logo and banner
// on the same code path since they only differ by S3 prefix and DB column.
type ImageKind = "logo" | "banner";
const IMAGE_KINDS: ImageKind[] = ["logo", "banner"];

function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildPublicFileUrl(key: string): string {
    const bucket = process.env.S3_BUCKET_NAME!;
    const region = process.env.AWS_REGION!;
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

// GET /stores/:sellerId — public shop profile (anyone can view).
export async function getStore(req: Request, res: Response) {
    const sellerId = parseInt(req.params.sellerId as string);
    if (isNaN(sellerId)) {
        res.status(400).json({ error: "Invalid seller id" });
        return;
    }

    const store = await prisma.store.findUnique({ where: { sellerId } });
    if (!store) {
        res.status(404).json({ error: "Store not found" });
        return;
    }

    res.json(store);
}

// GET /stores/:sellerId/assets — published assets that belong to this shop's
// seller, with the same rating summary shape the marketplace cards expect.
export async function getStoreAssets(req: Request, res: Response) {
    const sellerId = parseInt(req.params.sellerId as string);
    if (isNaN(sellerId)) {
        res.status(400).json({ error: "Invalid seller id" });
        return;
    }

    const assets = await prisma.asset.findMany({
        where: { sellerId, status: "PUBLISHED", isDeleted: false },
        include: {
            files: true,
            seller: { select: { userId: true, name: true, avatarUrl: true, store: { select: { storeName: true, logoUrl: true } } } },
        },
        orderBy: { createdAt: "desc" },
    });

    const ratings = await prisma.review.groupBy({
        by: ["assetId"],
        where: { assetId: { in: assets.map((a) => a.id) } },
        _avg: { rating: true },
        _count: true,
    });
    const ratingByAssetId = new Map(
        ratings.map((r) => [r.assetId, { averageRating: r._avg.rating ?? 0, reviewCount: r._count }]),
    );
    const items = assets.map((a) => ({
        ...a,
        averageRating: ratingByAssetId.get(a.id)?.averageRating ?? 0,
        reviewCount: ratingByAssetId.get(a.id)?.reviewCount ?? 0,
    }));

    res.json({ items });
}

// GET /stores/me — the logged-in seller's own shop.
export async function getMyStore(req: Request, res: Response) {
    const userId = req.user!.userId;

    const store = await prisma.store.findUnique({ where: { sellerId: userId } });
    if (!store) {
        res.status(404).json({ error: "Store not found" });
        return;
    }

    res.json(store);
}

// PATCH /stores/me — edit shop name / description.
export async function updateMyStore(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { storeName, description } = req.body;

    if (storeName !== undefined && (typeof storeName !== "string" || storeName.trim() === "")) {
        res.status(400).json({ error: "storeName must be a non-empty string" });
        return;
    }

    const store = await prisma.store.findUnique({ where: { sellerId: userId } });
    if (!store) {
        res.status(404).json({ error: "Store not found" });
        return;
    }

    const updated = await prisma.store.update({
        where: { sellerId: userId },
        data: {
            ...(storeName !== undefined && { storeName: storeName.trim() }),
            ...(description !== undefined && { description }),
        },
    });

    res.json(updated);
}

// POST /stores/me/:kind/upload-url — presigned URL for logo or banner.
export async function getStoreImageUploadUrl(req: Request, res: Response) {
    const userId = req.user!.userId;
    const kind = req.params.kind as ImageKind;
    const { fileName, fileType, fileSize } = req.body;

    if (!IMAGE_KINDS.includes(kind)) {
        res.status(400).json({ error: "kind must be 'logo' or 'banner'" });
        return;
    }
    if (!fileName || !fileType || typeof fileSize !== "number") {
        res.status(400).json({ error: "fileName, fileType, and fileSize are required" });
        return;
    }
    if (!fileType.startsWith("image/")) {
        res.status(400).json({ error: `${kind} must be an image` });
        return;
    }
    if (fileSize <= 0 || fileSize > MAX_IMAGE_SIZE) {
        res.status(400).json({
            error: `fileSize must be between 1 and ${MAX_IMAGE_SIZE} bytes (5 MB)`,
        });
        return;
    }

    const safeName = sanitizeFileName(fileName);
    const key = `stores/${userId}/${kind}/${Date.now()}-${safeName}`;

    const result = await getPresignedUploadUrl({
        key,
        contentType: fileType,
        contentLength: fileSize,
    });

    res.json({ uploadUrl: result.url, key: result.key, expiresIn: result.expiresIn });
}

// PATCH /stores/me/:kind — apply an uploaded logo/banner to the shop, deleting
// the old object if one existed.
export async function updateStoreImage(req: Request, res: Response) {
    const userId = req.user!.userId;
    const kind = req.params.kind as ImageKind;
    const { key } = req.body;

    if (!IMAGE_KINDS.includes(kind)) {
        res.status(400).json({ error: "kind must be 'logo' or 'banner'" });
        return;
    }
    if (!key || typeof key !== "string") {
        res.status(400).json({ error: "key is required" });
        return;
    }

    const expectedPrefix = `stores/${userId}/${kind}/`;
    if (!key.startsWith(expectedPrefix)) {
        res.status(403).json({ error: "Key does not belong to this store" });
        return;
    }

    const store = await prisma.store.findUnique({ where: { sellerId: userId } });
    if (!store) {
        res.status(404).json({ error: "Store not found" });
        return;
    }

    const column = kind === "logo" ? "logoUrl" : "bannerUrl";
    const existingUrl = store[column];
    if (existingUrl) {
        try {
            await deleteObject(extractKeyFromUrl(existingUrl));
        } catch {
            // ignore — old object may already be gone
        }
    }

    const updated = await prisma.store.update({
        where: { sellerId: userId },
        data: { [column]: buildPublicFileUrl(key) },
    });

    res.json(updated);
}
