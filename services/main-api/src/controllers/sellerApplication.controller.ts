import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getPresignedUploadUrl, getPresignedDownloadUrl } from "../lib/s3";
import { publishSellerApproved, publishSellerRejected, publishSellerRevoked, publishSellerReinstated } from "../lib/publisher";

const MAX_ID_DOCUMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_ID_DOCUMENT_TYPES = ["image/jpeg", "image/png", "application/pdf"];

function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function getIdDocumentUploadUrl(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { fileName, fileType, fileSize } = req.body;

    if (!fileName || !fileType || typeof fileSize !== "number") {
        res.status(400).json({ error: "fileName, fileType, and fileSize are required" });
        return;
    }

    if (!ALLOWED_ID_DOCUMENT_TYPES.includes(fileType)) {
        res.status(400).json({ error: "ID document must be a JPG, PNG, or PDF" });
        return;
    }

    if (fileSize <= 0 || fileSize > MAX_ID_DOCUMENT_SIZE) {
        res.status(400).json({
            error: `fileSize must be between 1 and ${MAX_ID_DOCUMENT_SIZE} bytes (10 MB)`,
        });
        return;
    }

    const safeName = sanitizeFileName(fileName);
    const key = `seller-ids/${userId}/${Date.now()}-${safeName}`;

    const result = await getPresignedUploadUrl({
        key,
        contentType: fileType,
        contentLength: fileSize,
    });

    res.json({ uploadUrl: result.url, key: result.key, expiresIn: result.expiresIn });
}

export async function submitApplication(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { storeName, reason, portfolioLink, fullName, dateOfBirth, address, idDocumentKey } = req.body;

    if (req.user!.roles.includes("ADMIN")) {
        res.status(403).json({ error: "Admins cannot apply as sellers" });
        return;
    }

    if (!storeName || !reason || !fullName || !dateOfBirth || !address || !idDocumentKey) {
        res.status(400).json({
            error: "storeName, reason, fullName, dateOfBirth, address, and idDocumentKey are required",
        });
        return;
    }

    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
        res.status(400).json({ error: "dateOfBirth must be a valid date" });
        return;
    }

    const expectedPrefix = `seller-ids/${userId}/`;
    if (!idDocumentKey.startsWith(expectedPrefix)) {
        res.status(403).json({ error: "idDocumentKey does not belong to this user" });
        return;
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
        res.status(404).json({ error: "User profile not found" });
        return;
    }

    const existing = await prisma.sellerApplication.findFirst({
        where: { userId, status: { in: ["PENDING", "APPROVED"] } },
    });
    if (existing) {
        res.status(409).json({ error: "You already have a pending or approved application" });
        return;
    }

    const application = await prisma.sellerApplication.create({
        data: { userId, storeName, reason, portfolioLink, fullName, dateOfBirth: dob, address, idDocumentKey },
    });

    res.status(201).json(application);
}

export async function getMyApplication(req: Request, res: Response) {
    const userId = req.user!.userId;

    const application = await prisma.sellerApplication.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
    });

    if (!application) {
        res.status(404).json({ error: "No application found" });
        return;
    }

    res.json(application);
}

export async function listApplications(req: Request, res: Response) {
    const { status } = req.query;

    const applications = await prisma.sellerApplication.findMany({
        where: status ? { status: status as any } : undefined,
        include: { user: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
    });

    res.json(applications);
}

export async function getApplication(req: Request, res: Response) {
    const id = parseInt(req.params.id as string);
    if (Number.isNaN(id)) {
        res.status(400).json({ error: "Invalid application id" });
        return;
    }

    const application = await prisma.sellerApplication.findUnique({
        where: { id },
        include: { user: { select: { name: true, email: true, avatarUrl: true } } },
    });

    if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
    }

    res.json(application);
}

export async function getIdDocumentDownloadUrl(req: Request, res: Response) {
    const id = parseInt(req.params.id as string);
    if (Number.isNaN(id)) {
        res.status(400).json({ error: "Invalid application id" });
        return;
    }

    const application = await prisma.sellerApplication.findUnique({ where: { id } });
    if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
    }
    if (!application.idDocumentKey) {
        res.status(404).json({ error: "This application has no ID document" });
        return;
    }

    const { url, expiresIn } = await getPresignedDownloadUrl(application.idDocumentKey);
    res.json({ downloadUrl: url, expiresIn });
}

export async function approveApplication(req: Request, res: Response) {
    const id = parseInt(req.params.id as string);

    const application = await prisma.sellerApplication.findUnique({ where: { id } });
    if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
    }
    if (application.status !== "PENDING") {
        res.status(409).json({ error: "Application is not pending" });
        return;
    }

    await prisma.sellerApplication.update({
        where: { id },
        data: { status: "APPROVED", reviewedAt: new Date() },
    });

    // Give the new seller a shop, seeded from their application's store name.
    // upsert so re-approval (after a revoke) doesn't overwrite an edited shop.
    await prisma.store.upsert({
        where: { sellerId: application.userId },
        create: { sellerId: application.userId, storeName: application.storeName },
        update: {},
    });

    await prisma.roleChangeLog.create({
        data: {
            targetUserId: application.userId,
            adminUserId: req.user!.userId,
            action: "GRANT",
            role: "SELLER",
        },
    });

    const userProfile = await prisma.userProfile.findUnique({
        where: { userId: application.userId },
    });
    if (!userProfile?.email) {
        res.status(500).json({ error: "User email not found; cannot notify seller" });
        return;
    }

    await publishSellerApproved({
        userId: application.userId,
        email: userProfile.email,
        storeName: application.storeName,
    });

    res.json({ message: "Application approved" });
}

export async function rejectApplication(req: Request, res: Response) {
    const id = parseInt(req.params.id as string);
    const { adminNote } = req.body;

    if (!adminNote) {
        res.status(400).json({ error: "adminNote is required when rejecting" });
        return;
    }

    const application = await prisma.sellerApplication.findUnique({ where: { id } });
    if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
    }
    if (application.status !== "PENDING") {
        res.status(409).json({ error: "Application is not pending" });
        return;
    }

    await prisma.sellerApplication.update({
        where: { id },
        data: { status: "REJECTED", adminNote, reviewedAt: new Date() },
    });

    const userProfile = await prisma.userProfile.findUnique({
        where: { userId: application.userId },
    });
    if (!userProfile?.email) {
        res.status(500).json({ error: "User email not found; cannot notify seller" });
        return;
    }

    await publishSellerRejected({
        userId: application.userId,
        email: userProfile.email,
        storeName: application.storeName,
        adminNote,
    });

    res.json({ message: "Application rejected" });
}

export async function revokeSeller(req: Request, res: Response) {
    const userId = parseInt(req.params.userId as string);
    const { adminNote } = req.body;

    if (Number.isNaN(userId)) {
        res.status(400).json({ error: "Invalid userId" });
        return;
    }

    if (!adminNote) {
        res.status(400).json({ error: "adminNote is required when revoking" });
        return;
    }

    const application = await prisma.sellerApplication.findFirst({
        where: { userId, status: "APPROVED" },
    });
    if (!application) {
        res.status(404).json({ error: "User is not an approved seller" });
        return;
    }

    // Hide this seller's live listings from the marketplace. Tag them with
    // hiddenByRevoke so a later reinstate restores exactly these assets.
    await prisma.asset.updateMany({
        where: { sellerId: userId, status: "PUBLISHED" },
        data: { status: "TAKEN_DOWN", hiddenByRevoke: true },
    });

    // Mark the application REVOKED (distinct from a rejected applicant) so it
    // can be listed and reinstated later.
    await prisma.sellerApplication.update({
        where: { id: application.id },
        data: { status: "REVOKED", adminNote },
    });

    await prisma.roleChangeLog.create({
        data: {
            targetUserId: userId,
            adminUserId: req.user!.userId,
            action: "REVOKE",
            role: "SELLER",
            reason: adminNote,
        },
    });

    const userProfile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!userProfile?.email) {
        res.status(500).json({ error: "User email not found; cannot notify seller" });
        return;
    }

    // Tell auth-service to drop the SELLER role and notify the seller.
    await publishSellerRevoked({
        userId,
        email: userProfile.email,
        storeName: application.storeName,
        adminNote,
    });

    res.json({ message: "Seller role revoked and listings hidden" });
}

export async function reinstateSeller(req: Request, res: Response) {
    const userId = parseInt(req.params.userId as string);

    if (Number.isNaN(userId)) {
        res.status(400).json({ error: "Invalid userId" });
        return;
    }

    const application = await prisma.sellerApplication.findFirst({
        where: { userId, status: "REVOKED" },
    });
    if (!application) {
        res.status(404).json({ error: "User is not a revoked seller" });
        return;
    }

    // Re-publish exactly the listings that this revoke hid, then clear the tag.
    await prisma.asset.updateMany({
        where: { sellerId: userId, hiddenByRevoke: true },
        data: { status: "PUBLISHED", hiddenByRevoke: false },
    });

    // Restore the application to APPROVED.
    await prisma.sellerApplication.update({
        where: { id: application.id },
        data: { status: "APPROVED", adminNote: null },
    });

    await prisma.roleChangeLog.create({
        data: {
            targetUserId: userId,
            adminUserId: req.user!.userId,
            action: "GRANT",
            role: "SELLER",
            reason: "Seller reinstated by admin",
        },
    });

    const userProfile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!userProfile?.email) {
        res.status(500).json({ error: "User email not found; cannot notify seller" });
        return;
    }

    // Tell auth-service to grant the SELLER role back and notify the seller.
    await publishSellerReinstated({
        userId,
        email: userProfile.email,
        storeName: application.storeName,
    });

    res.json({ message: "Seller reinstated and listings restored" });
}
