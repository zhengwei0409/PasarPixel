import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export async function submitApplication(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { storeName, reason, portfolioLink, idVerificationUrl } = req.body;

    if (!storeName || !reason) {
        res.status(400).json({ error: "storeName and reason are required" });
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
        data: { userId, storeName, reason, portfolioLink, idVerificationUrl },
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
