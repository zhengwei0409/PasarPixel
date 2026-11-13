import { Request, Response } from "express";
import axios from "axios";
import type { AdminAccount } from "../../../../shared/types/adminAccount";
import { requireNonAdminAccount } from "../lib/adminAccountGuard";
import { prisma } from "../lib/prisma";
import { deleteObject, extractKeyFromUrl } from "../lib/s3";
import { publishUserDeleted } from "../lib/publisher";

// Auth owns the account list; a profile may not exist yet for every account.
export async function listUsers(req: Request, res: Response) {
    const authUrl = (process.env.AUTH_SERVICE_URL || "http://localhost:3001").replace(/\/$/, "");
    let accounts: AdminAccount[];
    try {
        const { data } = await axios.get<AdminAccount[]>(`${authUrl}/auth/admin/accounts`, {
            headers: { authorization: req.headers.authorization },
            timeout: 10_000,
        });
        accounts = data;
    } catch (error) {
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
            res.status(error.response.status).json({ error: "Unable to authorize the user list request" });
            return;
        }
        res.status(503).json({ error: "Unable to load user accounts. Please try again." });
        return;
    }

    const profiles = accounts.length ? await prisma.userProfile.findMany({
        select: { userId: true, name: true, avatarUrl: true },
    }) : [];
    const profilesById = new Map(profiles.map((profile) => [profile.userId, profile]));

    res.set("Cache-Control", "no-store").json(accounts.map((account) => {
        const profile = profilesById.get(account.userId);
        return {
            ...account,
            name: profile?.name ?? account.email,
            avatarUrl: profile?.avatarUrl ?? null,
            hasProfile: Boolean(profile),
        };
    }));
}

// Admin-only: hard-delete a user.
// 1. Delete their asset files (and avatar) from S3.
// 2. Delete all main-api business data tied to them, in FK-safe order.
// 3. Publish user.deleted so auth-service drops the account and
//    notification-service clears their notifications.
export async function deleteUser(req: Request, res: Response) {
    const targetUserId = Number(req.params.userId);
    const requester = req.user!;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

    if (!Number.isInteger(targetUserId) || targetUserId <= 0 || targetUserId > 2_147_483_647) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
    }

    if (requester.userId === targetUserId) {
        res.status(400).json({ error: "You cannot delete your own account" });
        return;
    }

    if (!reason) {
        res.status(400).json({ error: "A reason is required to delete a user" });
        return;
    }

    if (!await requireNonAdminAccount(req, res, targetUserId)) return;

    const profile = await prisma.userProfile.findUnique({
        where: { userId: targetUserId },
        include: { assets: { include: { files: true } }, store: true },
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
    if (profile.store?.logoUrl) {
        await deleteObject(extractKeyFromUrl(profile.store.logoUrl));
    }
    if (profile.store?.bannerUrl) {
        await deleteObject(extractKeyFromUrl(profile.store.bannerUrl));
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

        // The user's own assets and store, then the profile itself.
        await tx.asset.deleteMany({ where: { sellerId: targetUserId } });
        await tx.store.deleteMany({ where: { sellerId: targetUserId } });
        await tx.userProfile.delete({ where: { userId: targetUserId } });

        // Store the reason on the admin's activity, so deleting the target
        // account does not remove the deletion record.
        await tx.activityLog.create({
            data: {
                userId: requester.userId,
                action: `DELETE_USER: ${reason}`,
                targetType: "USER",
                targetId: targetUserId,
            },
        });
    });

    // 3. Tell the other services to clean up their own data.
    await publishUserDeleted({ userId: targetUserId });

    res.status(204).send();
}
