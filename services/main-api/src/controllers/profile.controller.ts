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
