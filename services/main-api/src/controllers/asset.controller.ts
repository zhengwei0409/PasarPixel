import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AssetCategory, ListingType } from "@prisma/client";
import { getPresignedUploadUrl, deleteObject, extractKeyFromUrl } from "../lib/s3";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_TOTAL_SIZE = 500 * 1024 * 1024;

const VALID_CATEGORIES: AssetCategory[] = [
    "THREE_D_MODEL",
    "IMAGE",
    "VIDEO",
    "SOUND_EFFECT",
    "FONT",
    "ANIMATION",
];

const VALID_LISTING_TYPES: ListingType[] = ["TRADITIONAL", "BLOCKCHAIN"];

export async function createAsset(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { title, description, category, listingType, isAiGenerated } = req.body;

    if (!title || !category || !listingType) {
        res.status(400).json({ error: "title, category, and listingType are required" });
        return;
    }

    if (!VALID_CATEGORIES.includes(category)) {
        res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` });
        return;
    }

    if (!VALID_LISTING_TYPES.includes(listingType)) {
        res.status(400).json({ error: `listingType must be one of: ${VALID_LISTING_TYPES.join(", ")}` });
        return;
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
        res.status(404).json({ error: "User profile not found" });
        return;
    }

    const asset = await prisma.asset.create({
        data: {
            sellerId: userId,
            title,
            description,
            category,
            listingType,
            isAiGenerated: Boolean(isAiGenerated),
        },
    });

    res.status(201).json(asset);
}

function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function getUploadUrl(req: Request, res: Response) {
    const userId = req.user!.userId;
    const assetId = parseInt(req.params.id as string);
    const { fileName, fileType, fileSize } = req.body;

    if (!fileName || !fileType || typeof fileSize !== "number") {
        res.status(400).json({ error: "fileName, fileType, and fileSize are required" });
        return;
    }

    if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
        res.status(400).json({ error: `fileSize must be between 1 and ${MAX_FILE_SIZE} bytes (100 MB)` });
        return;
    }

    const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        include: { files: true },
    });
    if (!asset) {
        res.status(404).json({ error: "Asset not found" });
        return;
    }
    if (asset.sellerId !== userId) {
        res.status(403).json({ error: "You do not own this asset" });
        return;
    }
    if (asset.status !== "DRAFT") {
        res.status(409).json({ error: "Files can only be added to draft assets" });
        return;
    }

    const currentTotal = asset.files.reduce((sum, f) => sum + f.fileSize, 0);
    if (currentTotal + fileSize > MAX_TOTAL_SIZE) {
        res.status(400).json({
            error: `Total listing size would exceed ${MAX_TOTAL_SIZE} bytes (500 MB)`,
        });
        return;
    }

    const safeName = sanitizeFileName(fileName);
    const key = `assets/${userId}/${assetId}/${Date.now()}-${safeName}`;

    const result = await getPresignedUploadUrl({
        key,
        contentType: fileType,
        contentLength: fileSize,
    });

    res.json({ uploadUrl: result.url, key: result.key, expiresIn: result.expiresIn });
}

function buildPublicFileUrl(key: string): string {
    const bucket = process.env.S3_BUCKET_NAME!;
    const region = process.env.AWS_REGION!;
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function registerFile(req: Request, res: Response) {
    const userId = req.user!.userId;
    const assetId = parseInt(req.params.id as string);
    const { key, fileType, fileSize } = req.body;

    if (!key || !fileType || typeof fileSize !== "number") {
        res.status(400).json({ error: "key, fileType, and fileSize are required" });
        return;
    }

    if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
        res.status(400).json({ error: `fileSize must be between 1 and ${MAX_FILE_SIZE} bytes (100 MB)` });
        return;
    }

    const expectedPrefix = `assets/${userId}/${assetId}/`;
    if (!key.startsWith(expectedPrefix)) {
        res.status(403).json({ error: "Key does not belong to this asset" });
        return;
    }

    const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        include: { files: true },
    });
    if (!asset) {
        res.status(404).json({ error: "Asset not found" });
        return;
    }
    if (asset.sellerId !== userId) {
        res.status(403).json({ error: "You do not own this asset" });
        return;
    }
    if (asset.status !== "DRAFT") {
        res.status(409).json({ error: "Files can only be added to draft assets" });
        return;
    }

    const currentTotal = asset.files.reduce((sum, f) => sum + f.fileSize, 0);
    if (currentTotal + fileSize > MAX_TOTAL_SIZE) {
        res.status(400).json({
            error: `Total listing size would exceed ${MAX_TOTAL_SIZE} bytes (500 MB)`,
        });
        return;
    }

    const file = await prisma.assetFile.create({
        data: {
            assetId,
            fileType,
            fileSize,
            fileUrl: buildPublicFileUrl(key),
        },
    });

    res.status(201).json(file);
}

export async function getMyAssets(req: Request, res: Response) {
    const userId = req.user!.userId;

    const assets = await prisma.asset.findMany({
        where: { sellerId: userId },
        include: { _count: { select: { files: true } } },
        orderBy: { createdAt: "desc" },
    });

    res.json(assets);
}

export async function deleteOrTakeDownAsset(req: Request, res: Response) {
    const userId = req.user!.userId;
    const assetId = parseInt(req.params.id as string);

    const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        include: { files: true },
    });
    if (!asset) {
        res.status(404).json({ error: "Asset not found" });
        return;
    }
    if (asset.sellerId !== userId) {
        res.status(403).json({ error: "You do not own this asset" });
        return;
    }

    if (asset.status === "DRAFT") {
        for (const file of asset.files) {
            const key = extractKeyFromUrl(file.fileUrl);
            await deleteObject(key);
        }
        await prisma.assetFile.deleteMany({ where: { assetId } });
        await prisma.asset.delete({ where: { id: assetId } });
        res.status(204).send();
        return;
    }

    if (asset.status === "PUBLISHED") {
        const updated = await prisma.asset.update({
            where: { id: assetId },
            data: { status: "TAKEN_DOWN", isDeleted: true },
        });
        res.json(updated);
        return;
    }

    res.status(409).json({
        error: `Cannot delete asset in ${asset.status} status. Use cancel-submission for PENDING_REVIEW.`,
    });
}

export async function updateAsset(req: Request, res: Response) {
    const userId = req.user!.userId;
    const assetId = parseInt(req.params.id as string);
    const { title, description, category, listingType, isAiGenerated } = req.body;

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.isDeleted) {
        res.status(404).json({ error: "Asset not found" });
        return;
    }
    if (asset.sellerId !== userId) {
        res.status(403).json({ error: "You do not own this asset" });
        return;
    }
    if (asset.status !== "DRAFT") {
        res.status(409).json({ error: "Only draft assets can be edited" });
        return;
    }

    if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
        res.status(400).json({ error: "title must be a non-empty string" });
        return;
    }
    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
        res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` });
        return;
    }
    if (listingType !== undefined && !VALID_LISTING_TYPES.includes(listingType)) {
        res.status(400).json({ error: `listingType must be one of: ${VALID_LISTING_TYPES.join(", ")}` });
        return;
    }

    const data: {
        title?: string;
        description?: string | null;
        category?: AssetCategory;
        listingType?: ListingType;
        isAiGenerated?: boolean;
    } = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description || null;
    if (category !== undefined) data.category = category;
    if (listingType !== undefined) data.listingType = listingType;
    if (isAiGenerated !== undefined) data.isAiGenerated = Boolean(isAiGenerated);

    const updated = await prisma.asset.update({
        where: { id: assetId },
        data,
    });

    res.json(updated);
}

export async function cancelSubmission(req: Request, res: Response) {
    const userId = req.user!.userId;
    const assetId = parseInt(req.params.id as string);

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.isDeleted) {
        res.status(404).json({ error: "Asset not found" });
        return;
    }
    if (asset.sellerId !== userId) {
        res.status(403).json({ error: "You do not own this asset" });
        return;
    }
    if (asset.status !== "PENDING_REVIEW") {
        res.status(409).json({ error: "Only assets pending review can have their submission cancelled" });
        return;
    }

    const updated = await prisma.asset.update({
        where: { id: assetId },
        data: { status: "DRAFT" },
    });

    res.json(updated);
}

export async function getPendingReviewAssets(_req: Request, res: Response) {
    const assets = await prisma.asset.findMany({
        where: { status: "PENDING_REVIEW", isDeleted: false },
        include: {
            _count: { select: { files: true } },
            seller: { select: { userId: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
    });

    res.json(assets);
}

export async function getAssetById(req: Request, res: Response) {
    const userId = req.user!.userId;
    const assetId = parseInt(req.params.id as string);

    const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        include: { files: true },
    });
    if (!asset || asset.isDeleted) {
        res.status(404).json({ error: "Asset not found" });
        return;
    }

    if (asset.status === "DRAFT" && asset.sellerId !== userId) {
        res.status(403).json({ error: "You do not have access to this asset" });
        return;
    }

    res.json(asset);
}

export async function submitForReview(req: Request, res: Response) {
    const userId = req.user!.userId;
    const assetId = parseInt(req.params.id as string);

    const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        include: { files: true },
    });
    if (!asset || asset.isDeleted) {
        res.status(404).json({ error: "Asset not found" });
        return;
    }
    if (asset.sellerId !== userId) {
        res.status(403).json({ error: "You do not own this asset" });
        return;
    }
    if (asset.status !== "DRAFT") {
        res.status(409).json({ error: "Only draft assets can be submitted for review" });
        return;
    }
    if (asset.files.length === 0) {
        res.status(400).json({ error: "Asset must have at least one file before submission" });
        return;
    }

    const updated = await prisma.asset.update({
        where: { id: assetId },
        data: { status: "PENDING_REVIEW" },
    });

    res.json(updated);
}

export async function approveAsset(req: Request, res: Response) {
    const assetId = parseInt(req.params.id as string);

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.isDeleted) {
        res.status(404).json({ error: "Asset not found" });
        return;
    }
    if (asset.status !== "PENDING_REVIEW") {
        res.status(409).json({ error: "Only assets pending review can be approved" });
        return;
    }

    const updated = await prisma.asset.update({
        where: { id: assetId },
        data: { status: "PUBLISHED", rejectionReason: null },
    });

    res.json(updated);
}

export async function rejectAsset(req: Request, res: Response) {
    const assetId = parseInt(req.params.id as string);
    const { reason } = req.body;

    if (typeof reason !== "string" || reason.trim().length === 0) {
        res.status(400).json({ error: "reason is required" });
        return;
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.isDeleted) {
        res.status(404).json({ error: "Asset not found" });
        return;
    }
    if (asset.status !== "PENDING_REVIEW") {
        res.status(409).json({ error: "Only assets pending review can be rejected" });
        return;
    }

    const updated = await prisma.asset.update({
        where: { id: assetId },
        data: { status: "REJECTED", rejectionReason: reason.trim() },
    });

    res.json(updated);
}

export async function deleteFile(req: Request, res: Response) {
    const userId = req.user!.userId;
    const assetId = parseInt(req.params.id as string);
    const fileId = parseInt(req.params.fileId as string);

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
        res.status(404).json({ error: "Asset not found" });
        return;
    }
    if (asset.sellerId !== userId) {
        res.status(403).json({ error: "You do not own this asset" });
        return;
    }
    if (asset.status !== "DRAFT") {
        res.status(409).json({ error: "Files can only be deleted from draft assets" });
        return;
    }

    const file = await prisma.assetFile.findUnique({ where: { id: fileId } });
    if (!file || file.assetId !== assetId) {
        res.status(404).json({ error: "File not found" });
        return;
    }

    const key = extractKeyFromUrl(file.fileUrl);
    await deleteObject(key);
    await prisma.assetFile.delete({ where: { id: fileId } });

    res.status(204).send();
}
