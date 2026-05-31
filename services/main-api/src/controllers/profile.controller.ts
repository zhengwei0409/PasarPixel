import { Request, Response } from "express";
import { Currency } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPresignedUploadUrl, deleteObject, extractKeyFromUrl } from "../lib/s3";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

const VALID_CURRENCIES: Currency[] = ["USD", "MYR"];

function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildPublicFileUrl(key: string): string {
    const bucket = process.env.S3_BUCKET_NAME!;
    const region = process.env.AWS_REGION!;
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function getMyProfile(req: Request, res: Response) {
    const userId = req.user!.userId;

    const profile = await prisma.userProfile.findUnique({
        where: { userId },
    });

    if (!profile) {
        res.status(404).json({ error: "Profile not found" });
        return;
    }

    res.json(profile);
}

export async function getAvatarUploadUrl(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { fileName, fileType, fileSize } = req.body;

    if (!fileName || !fileType || typeof fileSize !== "number") {
        res.status(400).json({ error: "fileName, fileType, and fileSize are required" });
        return;
    }

    if (!fileType.startsWith("image/")) {
        res.status(400).json({ error: "Avatar must be an image" });
        return;
    }

    if (fileSize <= 0 || fileSize > MAX_AVATAR_SIZE) {
        res.status(400).json({
            error: `fileSize must be between 1 and ${MAX_AVATAR_SIZE} bytes (5 MB)`,
        });
        return;
    }

    const safeName = sanitizeFileName(fileName);
    const key = `avatars/${userId}/${Date.now()}-${safeName}`;

    const result = await getPresignedUploadUrl({
        key,
        contentType: fileType,
        contentLength: fileSize,
    });

    res.json({ uploadUrl: result.url, key: result.key, expiresIn: result.expiresIn });
}

export async function updateAvatar(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { key } = req.body;

    if (!key || typeof key !== "string") {
        res.status(400).json({ error: "key is required" });
        return;
    }

    const expectedPrefix = `avatars/${userId}/`;
    if (!key.startsWith(expectedPrefix)) {
        res.status(403).json({ error: "Key does not belong to this user" });
        return;
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
        res.status(404).json({ error: "Profile not found" });
        return;
    }

    if (profile.avatarUrl) {
        try {
            await deleteObject(extractKeyFromUrl(profile.avatarUrl));
        } catch {
            // ignore — old object may already be gone
        }
    }

    const updated = await prisma.userProfile.update({
        where: { userId },
        data: { avatarUrl: buildPublicFileUrl(key) },
    });

    res.json(updated);
}

export async function deleteAvatar(req: Request, res: Response) {
    const userId = req.user!.userId;

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
        res.status(404).json({ error: "Profile not found" });
        return;
    }

    if (profile.avatarUrl) {
        try {
            await deleteObject(extractKeyFromUrl(profile.avatarUrl));
        } catch {
            // ignore
        }
    }

    const updated = await prisma.userProfile.update({
        where: { userId },
        data: { avatarUrl: null },
    });

    res.json(updated);
}

export async function updateMyProfile(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { name, bio, phone, socialLinks, preferredCurrency } = req.body;

    if (
        preferredCurrency !== undefined &&
        !VALID_CURRENCIES.includes(preferredCurrency as Currency)
    ) {
        res.status(400).json({ error: "preferredCurrency must be USD or MYR" });
        return;
    }

    const updated = await prisma.userProfile.update({
        where: { userId },
        data: {
            ...(name !== undefined && { name }),
            ...(bio !== undefined && { bio }),
            ...(phone !== undefined && { phone }),
            ...(socialLinks !== undefined && { socialLinks }),
            ...(preferredCurrency !== undefined && { preferredCurrency }),
        },
    });

    res.json(updated);
}
