import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { publishSellerApproved } from "../lib/publisher";

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

export async function listApplications(req: Request, res: Response) {
    const { status } = req.query;

    const applications = await prisma.sellerApplication.findMany({
        where: status ? { status: status as any } : undefined,
        include: { user: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
    });

    res.json(applications);
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

    await publishSellerApproved({
        userId: application.userId,
        email: '',
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

    res.json({ message: "Application rejected" });
}
