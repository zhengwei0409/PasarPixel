import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { deleteObject, extractKeyFromUrl } from "../lib/s3";
import { publishUserDeleted } from "../lib/publisher";

// Admin-only: list every user profile, newest first, for the admin user table.
export async function listUsers(req: Request, res: Response) {
    const profiles = await prisma.userProfile.findMany({
        orderBy: { createdAt: "desc" },
        select: {
            userId: true,
            name: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
        },
    });

    res.json(profiles);
}

// Admin-only: hard-delete a user.
// 1. Delete their asset files (and avatar) from S3.
// 2. Delete all main-api business data tied to them, in FK-safe order.
// 3. Publish user.deleted so auth-service drops the account and
//    notification-service clears their notifications.
export async function deleteUser(req: Request, res: Response) {
    const targetUserId = parseInt(req.params.userId as string);
    const requester = req.user!;

    if (requester.userId === targetUserId) {
        res.status(400).json({ error: "You cannot delete your own account" });
        return;
    }

    const profile = await prisma.userProfile.findUnique({
        where: { userId: targetUserId },
        include: { assets: { include: { files: true } } },
    });

    if (!profile) {
        res.status(404).json({ error: "User not found" });
        return;
    }

    // 1. Remove S3 objects: every file of every asset they own, plus avatar.
    for (const asset of profile.assets) {
        for (const file of asset.files) {
            await deleteObject(extractKeyFromUrl(file.fileUrl));
        }
    }
    if (profile.avatarUrl) {
        await deleteObject(extractKeyFromUrl(profile.avatarUrl));
    }

    const assetIds = profile.assets.map((asset) => asset.id);

    // 2. Delete business data in one transaction, children before parents.
    await prisma.$transaction(async (tx) => {
        // Rows referencing this user's assets (could belong to other users).
        if (assetIds.length > 0) {
            await tx.orderItem.deleteMany({ where: { assetId: { in: assetIds } } });
            await tx.cartItem.deleteMany({ where: { assetId: { in: assetIds } } });
            await tx.review.deleteMany({ where: { assetId: { in: assetIds } } });
            await tx.report.deleteMany({ where: { assetId: { in: assetIds } } });
            await tx.assetTag.deleteMany({ where: { assetId: { in: assetIds } } });
            await tx.assetFile.deleteMany({ where: { assetId: { in: assetIds } } });
        }

        // Rows where this user is the actor.
        await tx.cartItem.deleteMany({ where: { userId: targetUserId } });
        await tx.review.deleteMany({ where: { userId: targetUserId } });
        await tx.report.deleteMany({ where: { userId: targetUserId } });
        await tx.orderItem.deleteMany({ where: { order: { buyerId: targetUserId } } });
        await tx.order.deleteMany({ where: { buyerId: targetUserId } });
        await tx.withdrawalRequest.deleteMany({ where: { sellerId: targetUserId } });
        await tx.activityLog.deleteMany({ where: { userId: targetUserId } });
        await tx.sellerApplication.deleteMany({ where: { userId: targetUserId } });

        // The user's own assets, then the profile itself.
        await tx.asset.deleteMany({ where: { sellerId: targetUserId } });
        await tx.userProfile.delete({ where: { userId: targetUserId } });
    });

    // 3. Tell the other services to clean up their own data.
    await publishUserDeleted({ userId: targetUserId });

    res.status(204).send();
}
