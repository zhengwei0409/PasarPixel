import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AssetCategory, ListingType, Currency, AssetFilePurpose } from "@prisma/client";
import {
    getPresignedUploadUrl,
    deleteObject,
    extractKeyFromUrl,
    getObjectBuffer,
    putObjectBuffer,
} from "../lib/s3";
import { watermarkImage } from "../lib/watermark";
import { generateVideoPreview } from "../lib/videoPreview";
import { generateAudioPreview } from "../lib/audioPreview";
import { generateFontPreview } from "../lib/fontPreview";
import { publishAssetApproved, publishAssetRejected, publishAssetRemoved } from "../lib/publisher";

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

const VALID_CURRENCIES: Currency[] = ["USD", "MYR"];

type PricingInput = {
    pricePersonal?: unknown;
    priceCommercial?: unknown;
    priceSol?: unknown;
    currency?: unknown;
};

type PricingFields = {
    pricePersonal: Prisma.Decimal | null;
    priceCommercial: Prisma.Decimal | null;
    priceSol: Prisma.Decimal | null;
    currency: Currency;
};

function parsePrice(value: unknown, field: string): Prisma.Decimal | null | string {
    if (value === undefined || value === null || value === "") return null;
    const n = typeof value === "number" ? value : parseFloat(String(value));
    if (isNaN(n) || n < 0) return `${field} must be a non-negative number`;
    return new Prisma.Decimal(n);
}

function validatePricing(
    input: PricingInput,
    listingType: ListingType,
): { ok: true; data: PricingFields } | { ok: false; error: string } {
    const personal = parsePrice(input.pricePersonal, "pricePersonal");
    if (typeof personal === "string") return { ok: false, error: personal };
    const commercial = parsePrice(input.priceCommercial, "priceCommercial");
    if (typeof commercial === "string") return { ok: false, error: commercial };
    const sol = parsePrice(input.priceSol, "priceSol");
    if (typeof sol === "string") return { ok: false, error: sol };

    let currency: Currency = "USD";
    if (input.currency !== undefined && input.currency !== null) {
        if (!VALID_CURRENCIES.includes(input.currency as Currency)) {
            return { ok: false, error: `currency must be one of: ${VALID_CURRENCIES.join(", ")}` };
        }
        currency = input.currency as Currency;
    }

    if (listingType === "BLOCKCHAIN") {
        if (personal !== null || commercial !== null) {
            return { ok: false, error: "Blockchain listings cannot set fiat prices" };
        }
    } else {
        if (sol !== null) {
            return { ok: false, error: "Traditional listings cannot set SOL price" };
        }
    }

    return {
        ok: true,
        data: {
            pricePersonal: personal,
            priceCommercial: commercial,
            priceSol: sol,
            currency,
        },
    };
}

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

    const pricing = validatePricing(req.body, listingType);
    if (!pricing.ok) {
        res.status(400).json({ error: pricing.error });
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
            pricePersonal: pricing.data.pricePersonal,
            priceCommercial: pricing.data.priceCommercial,
            priceSol: pricing.data.priceSol,
            currency: pricing.data.currency,
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
    const { fileName, fileType, fileSize, purpose } = req.body;

    if (!fileName || !fileType || typeof fileSize !== "number") {
        res.status(400).json({ error: "fileName, fileType, and fileSize are required" });
        return;
    }

    if (purpose !== undefined && purpose !== "ORIGINAL" && purpose !== "PREVIEW") {
        res.status(400).json({ error: "purpose must be ORIGINAL or PREVIEW" });
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

    // PREVIEW files (e.g. a low-poly glb) live under the public previews/ prefix
    // so they can be shown to anyone. ORIGINAL paid files stay under assets/,
    // which is private and only served through the authenticated download.
    const prefix = purpose === "PREVIEW" ? "previews" : "assets";
    const safeName = sanitizeFileName(fileName);
    const key = `${prefix}/${userId}/${assetId}/${Date.now()}-${safeName}`;

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
    const { key, fileType, fileSize, purpose } = req.body;

    if (!key || !fileType || typeof fileSize !== "number") {
        res.status(400).json({ error: "key, fileType, and fileSize are required" });
        return;
    }

    if (purpose !== undefined && purpose !== "ORIGINAL" && purpose !== "PREVIEW") {
        res.status(400).json({ error: "purpose must be ORIGINAL or PREVIEW" });
        return;
    }
    const filePurpose: AssetFilePurpose = purpose === "PREVIEW" ? "PREVIEW" : "ORIGINAL";

    if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
        res.status(400).json({ error: `fileSize must be between 1 and ${MAX_FILE_SIZE} bytes (100 MB)` });
        return;
    }

    // The prefix must match what getUploadUrl handed out for this purpose, so a
    // seller can't smuggle a paid original into the public previews/ prefix.
    const prefix = filePurpose === "PREVIEW" ? "previews" : "assets";
    const expectedPrefix = `${prefix}/${userId}/${assetId}/`;
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

    const fileUrl = buildPublicFileUrl(key);
    let previewUrl: string | null = null;

    // Auto-generated previews (watermark, clip, etc.) must be publicly readable,
    // so derive their key under previews/ — the original may now live under the
    // private assets/ prefix. A PREVIEW file is already a preview, so skip this.
    const previewBaseKey = `previews/${userId}/${assetId}/${key.split("/").pop()}`.replace(/(\.[^.]+)?$/, "");

    if (filePurpose === "PREVIEW") {
        // No derived preview needed; the uploaded file itself is the preview.
    } else if (fileType.startsWith("image/")) {
        try {
            const original = await getObjectBuffer(key);
            const watermarked = await watermarkImage(original);
            previewUrl = await putObjectBuffer({
                key: previewBaseKey + ".preview.jpg",
                body: watermarked,
                contentType: "image/jpeg",
            });
        } catch (err) {
            console.error("Watermark generation failed", { key, err });
        }
    } else if (asset.category === "ANIMATION" && fileType.startsWith("video/")) {
        try {
            const original = await getObjectBuffer(key);
            const preview = await generateVideoPreview(original, { fullLength: true });
            previewUrl = await putObjectBuffer({
                key: previewBaseKey + ".preview.mp4",
                body: preview,
                contentType: "video/mp4",
            });
        } catch (err) {
            console.error("Animation video preview generation failed", { key, err });
        }
    } else if (fileType.startsWith("video/")) {
        try {
            const original = await getObjectBuffer(key);
            const preview = await generateVideoPreview(original);
            previewUrl = await putObjectBuffer({
                key: previewBaseKey + ".preview.mp4",
                body: preview,
                contentType: "video/mp4",
            });
        } catch (err) {
            console.error("Video preview generation failed", { key, err });
        }
    } else if (fileType.startsWith("audio/")) {
        try {
            const original = await getObjectBuffer(key);
            const preview = await generateAudioPreview(original);
            previewUrl = await putObjectBuffer({
                key: previewBaseKey + ".preview.m4a",
                body: preview,
                contentType: "audio/mp4",
            });
        } catch (err) {
            console.error("Audio preview generation failed", { key, err });
        }
    } else if (
        fileType.startsWith("font/") ||
        fileType.includes("font") ||
        /\.(ttf|otf|woff2?|eot)$/i.test(key)
    ) {
        try {
            const original = await getObjectBuffer(key);
            const preview = await generateFontPreview(original);
            previewUrl = await putObjectBuffer({
                key: previewBaseKey + ".preview.png",
                body: preview,
                contentType: "image/png",
            });
        } catch (err) {
            console.error("Font preview generation failed", { key, err });
        }
    }

    const file = await prisma.assetFile.create({
        data: {
            assetId,
            fileType,
            fileSize,
            fileUrl,
            previewUrl,
            purpose: filePurpose,
        },
    });

    res.status(201).json(file);
}

const VALID_SORTS = ["newest", "price_asc", "price_desc"] as const;
type SortOption = (typeof VALID_SORTS)[number];

function parsePositiveInt(value: unknown, fallback: number, max?: number): number {
    const n = parseInt(String(value ?? ""), 10);
    if (isNaN(n) || n < 1) return fallback;
    if (max !== undefined && n > max) return max;
    return n;
}

export async function browseAssets(req: Request, res: Response) {
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, 20, 50);
    const sort: SortOption = VALID_SORTS.includes(req.query.sort as SortOption)
        ? (req.query.sort as SortOption)
        : "newest";

    const orderBy =
        sort === "price_asc"
            ? { pricePersonal: "asc" as const }
            : sort === "price_desc"
              ? { pricePersonal: "desc" as const }
              : { createdAt: "desc" as const };

    const where: Prisma.AssetWhereInput = {
        status: "PUBLISHED",
        isDeleted: false,
    };

    const category = req.query.category as string | undefined;
    if (category && VALID_CATEGORIES.includes(category as AssetCategory)) {
        where.category = category as AssetCategory;
    }

    const listingType = req.query.listingType as string | undefined;
    if (listingType && VALID_LISTING_TYPES.includes(listingType as ListingType)) {
        where.listingType = listingType as ListingType;
    }

    const isAiGenerated = req.query.isAiGenerated as string | undefined;
    if (isAiGenerated === "true") {
        where.isAiGenerated = true;
    } else if (isAiGenerated === "false") {
        where.isAiGenerated = false;
    }

    const priceFilter: Prisma.DecimalFilter = {};
    const minPrice = parseFloat(String(req.query.minPrice ?? ""));
    const maxPrice = parseFloat(String(req.query.maxPrice ?? ""));
    if (!isNaN(minPrice) && minPrice >= 0) priceFilter.gte = minPrice;
    if (!isNaN(maxPrice) && maxPrice >= 0) priceFilter.lte = maxPrice;
    if (Object.keys(priceFilter).length > 0) {
        where.pricePersonal = priceFilter;
    }

    const keyword = (req.query.keyword as string | undefined)?.trim();
    if (keyword) {
        where.OR = [
            { title: { contains: keyword, mode: "insensitive" } },
            { description: { contains: keyword, mode: "insensitive" } },
        ];
    }

    const [assets, total] = await Promise.all([
        prisma.asset.findMany({
            where,
            include: {
                files: true,
                seller: { select: { userId: true, name: true, avatarUrl: true } },
            },
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.asset.count({ where }),
    ]);

    // Batch the rating summary for every asset on this page in a single query,
    // then merge it back in — avoids one aggregate per asset (N+1).
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

    res.json({ items, total, page, pageSize });
}

export async function getPublicAssetById(req: Request, res: Response) {
    const assetId = parseInt(req.params.id as string);
    if (isNaN(assetId)) {
        res.status(400).json({ error: "Invalid asset id" });
        return;
    }

    const asset = await prisma.asset.findFirst({
        where: { id: assetId, status: "PUBLISHED", isDeleted: false },
        include: {
            files: true,
            seller: { select: { userId: true, name: true, avatarUrl: true } },
        },
    });
    if (!asset) {
        res.status(404).json({ error: "Asset not found" });
        return;
    }

    const summary = await prisma.review.aggregate({
        where: { assetId },
        _avg: { rating: true },
        _count: true,
    });

    res.json({
        ...asset,
        averageRating: summary._avg.rating ?? 0,
        reviewCount: summary._count,
    });
}

const RELATED_LIMIT = 4;

export async function getRelatedAssets(req: Request, res: Response) {
    const assetId = parseInt(req.params.id as string);
    if (isNaN(assetId)) {
        res.status(400).json({ error: "Invalid asset id" });
        return;
    }

    const asset = await prisma.asset.findFirst({
        where: { id: assetId, status: "PUBLISHED", isDeleted: false },
        select: { category: true },
    });
    if (!asset) {
        res.status(404).json({ error: "Asset not found" });
        return;
    }

    const items = await prisma.asset.findMany({
        where: {
            status: "PUBLISHED",
            isDeleted: false,
            category: asset.category,
            id: { not: assetId },
        },
        include: {
            files: true,
            seller: { select: { userId: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
        take: RELATED_LIMIT,
    });

    res.json({ items });
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

        await publishAssetRemoved({
            sellerId: asset.sellerId,
            assetId: asset.id,
            assetTitle: asset.title,
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
        pricePersonal?: Prisma.Decimal | null;
        priceCommercial?: Prisma.Decimal | null;
        priceSol?: Prisma.Decimal | null;
        currency?: Currency;
    } = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description || null;
    if (category !== undefined) data.category = category;
    if (listingType !== undefined) data.listingType = listingType;
    if (isAiGenerated !== undefined) data.isAiGenerated = Boolean(isAiGenerated);

    const pricingTouched =
        req.body.pricePersonal !== undefined ||
        req.body.priceCommercial !== undefined ||
        req.body.priceSol !== undefined ||
        req.body.currency !== undefined;

    if (pricingTouched) {
        const effectiveListingType = (listingType ?? asset.listingType) as ListingType;
        const pricing = validatePricing(req.body, effectiveListingType);
        if (!pricing.ok) {
            res.status(400).json({ error: pricing.error });
            return;
        }
        if (req.body.pricePersonal !== undefined) data.pricePersonal = pricing.data.pricePersonal;
        if (req.body.priceCommercial !== undefined) data.priceCommercial = pricing.data.priceCommercial;
        if (req.body.priceSol !== undefined) data.priceSol = pricing.data.priceSol;
        if (req.body.currency !== undefined) data.currency = pricing.data.currency;
    }

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

    if (asset.category === "ANIMATION") {
        const has3d = asset.files.some(
            (f) => f.fileType.startsWith("model/") || /\.(glb|fbx|blend)$/i.test(f.fileUrl),
        );
        const hasVideo = asset.files.some((f) => f.fileType.startsWith("video/"));
        if (!has3d) {
            res.status(400).json({ error: "Animation assets must include a 3D file (.glb, .fbx, or .blend)" });
            return;
        }
        if (!hasVideo) {
            res.status(400).json({ error: "Animation assets must include an MP4 preview video" });
            return;
        }
    }

    if (asset.category === "THREE_D_MODEL") {
        const hasPreviewGlb = asset.files.some(
            (f) => f.purpose === "PREVIEW" && /\.glb$/i.test(f.fileUrl),
        );
        const hasOriginal = asset.files.some((f) => f.purpose === "ORIGINAL");
        if (!hasPreviewGlb) {
            res.status(400).json({
                error: "3D Model assets must include a preview .glb file for the interactive 3D viewer",
            });
            return;
        }
        if (!hasOriginal) {
            res.status(400).json({
                error: "3D Model assets must include the original file for buyers to download",
            });
            return;
        }
    }

    // Categories with no static image of their own need a seller-uploaded
    // cover image so the marketplace card has a thumbnail.
    const COVER_REQUIRED: AssetCategory[] = [
        "THREE_D_MODEL",
        "SOUND_EFFECT",
        "VIDEO",
        "ANIMATION",
    ];
    if (COVER_REQUIRED.includes(asset.category)) {
        const hasImage = asset.files.some((f) => f.fileType.startsWith("image/"));
        if (!hasImage) {
            res.status(400).json({
                error: "This asset must include a cover image (shown as the marketplace thumbnail)",
            });
            return;
        }
    }

    if (asset.listingType === "BLOCKCHAIN") {
        if (asset.priceSol === null) {
            res.status(400).json({ error: "Blockchain listings must set a SOL price before submission" });
            return;
        }
    } else {
        if (asset.pricePersonal === null && asset.priceCommercial === null) {
            res.status(400).json({
                error: "At least one license tier (Personal or Commercial) must have a price before submission",
            });
            return;
        }
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

    await publishAssetApproved({
        sellerId: asset.sellerId,
        assetId: asset.id,
        assetTitle: asset.title,
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

    await publishAssetRejected({
        sellerId: asset.sellerId,
        assetId: asset.id,
        assetTitle: asset.title,
        rejectionReason: reason.trim(),
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
