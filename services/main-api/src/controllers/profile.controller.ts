import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

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

export async function updateMyProfile(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { name, bio, phone, socialLinks } = req.body;

    const updated = await prisma.userProfile.update({
        where: { userId },
        data: {
            ...(name !== undefined && { name }),
            ...(bio !== undefined && { bio }),
            ...(phone !== undefined && { phone }),
            ...(socialLinks !== undefined && { socialLinks }),
        },
    });

    res.json(updated);
}
