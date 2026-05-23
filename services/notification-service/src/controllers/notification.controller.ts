import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export async function listNotifications(req: Request, res: Response) {
    const userId = req.user!.userId;
    const unreadOnly = req.query.unreadOnly === "true";
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const notifications = await prisma.notification.findMany({
        where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
    });

    res.json(notifications);
}

export async function getUnreadCount(req: Request, res: Response) {
    const userId = req.user!.userId;

    const count = await prisma.notification.count({
        where: { userId, readAt: null },
    });

    res.json({ count });
}

export async function markAsRead(req: Request, res: Response) {
    const userId = req.user!.userId;
    const id = parseInt(req.params.id as string);

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
        res.status(404).json({ error: "Notification not found" });
        return;
    }

    const updated = await prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
    });

    res.json(updated);
}

export async function markAllAsRead(req: Request, res: Response) {
    const userId = req.user!.userId;

    const result = await prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
    });

    res.json({ updated: result.count });
}
