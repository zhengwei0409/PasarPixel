import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { publishReviewReceived } from "../lib/publisher";

// GET /assets/:id/reviews — public list of an asset's reviews plus its rating
// summary (FR-2.8). No JWT: anyone browsing the detail page can read reviews.
export async function getAssetReviews(req: Request, res: Response) {
    const assetId = parseInt(req.params.id as string);
    if (isNaN(assetId)) {
        res.status(400).json({ error: "Invalid asset id" });
        return;
    }

    const [items, summary] = await Promise.all([
        prisma.review.findMany({
            where: { assetId },
            include: {
                user: { select: { userId: true, name: true, avatarUrl: true } },
            },
            orderBy: { createdAt: "desc" },
        }),
        prisma.review.aggregate({
            where: { assetId },
            _avg: { rating: true },
            _count: true,
        }),
    ]);

    res.json({
        items,
        averageRating: summary._avg.rating ?? 0,
        count: summary._count,
    });
}

// Has this user actually bought this asset? A review only counts if there's a
// COMPLETED order of theirs containing the asset (FR-2.8 "verified buyers").
async function hasPurchasedAsset(userId: number, assetId: number): Promise<boolean> {
    const order = await prisma.order.findFirst({
        where: {
            buyerId: userId,
            paymentStatus: "COMPLETED",
            orderItems: { some: { assetId } },
        },
        select: { id: true },
    });
    return order !== null;
}

// POST /assets/:id/reviews — create or update the caller's review (FR-2.8).
// The reviews_userId_assetId unique constraint enforces one review per buyer per
// asset, so re-posting upserts instead of duplicating.
export async function upsertReview(req: Request, res: Response) {
    const userId = req.user!.userId;
    const assetId = parseInt(req.params.id as string);
    if (isNaN(assetId)) {
        res.status(400).json({ error: "Invalid asset id" });
        return;
    }

    const { rating, comment } = req.body;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        res.status(400).json({ error: "rating must be an integer between 1 and 5" });
        return;
    }
    if (comment !== undefined && comment !== null && typeof comment !== "string") {
        res.status(400).json({ error: "comment must be a string" });
        return;
    }

    const asset = await prisma.asset.findFirst({
        where: { id: assetId, status: "PUBLISHED", isDeleted: false },
        select: { sellerId: true, title: true },
    });
    if (!asset) {
        res.status(404).json({ error: "Asset not found" });
        return;
    }
    if (asset.sellerId === userId) {
        res.status(403).json({ error: "You cannot review your own asset" });
        return;
    }

    if (!(await hasPurchasedAsset(userId, assetId))) {
        res.status(403).json({ error: "Only buyers who purchased this asset can review it" });
        return;
    }

    const trimmedComment =
        typeof comment === "string" && comment.trim().length > 0 ? comment.trim() : null;

    // Tell new reviews apart from edits: only a brand-new review should notify
    // the seller, so re-rating later doesn't spam them.
    const existingReview = await prisma.review.findUnique({
        where: { userId_assetId: { userId, assetId } },
        select: { id: true },
    });

    const review = await prisma.review.upsert({
        where: { userId_assetId: { userId, assetId } },
        create: { userId, assetId, rating, comment: trimmedComment },
        update: { rating, comment: trimmedComment },
        include: {
            user: { select: { userId: true, name: true, avatarUrl: true } },
        },
    });

    if (!existingReview) {
        await publishReviewReceived({
            sellerId: asset.sellerId,
            assetId,
            assetTitle: asset.title,
            rating,
        });
    }

    res.status(201).json(review);
}

// DELETE /assets/:id/reviews — remove the caller's own review (FR-2.8).
export async function deleteReview(req: Request, res: Response) {
    const userId = req.user!.userId;
    const assetId = parseInt(req.params.id as string);
    if (isNaN(assetId)) {
        res.status(400).json({ error: "Invalid asset id" });
        return;
    }

    const existing = await prisma.review.findUnique({
        where: { userId_assetId: { userId, assetId } },
        select: { id: true },
    });
    if (!existing) {
        res.status(404).json({ error: "Review not found" });
        return;
    }

    await prisma.review.delete({ where: { userId_assetId: { userId, assetId } } });
    res.status(204).send();
}
