import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// Admin-only: list role-change history, newest first.
// Each log stores only user IDs, so we look up the target user's and the
// acting admin's names/emails and attach them for display.
export async function listRoleLogs(req: Request, res: Response) {
    const logs = await prisma.roleChangeLog.findMany({
        orderBy: { createdAt: "desc" },
    });

    const userIds = [
        ...new Set(logs.flatMap((log) => [log.targetUserId, log.adminUserId])),
    ];

    const profiles = await prisma.userProfile.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, name: true, email: true },
    });

    const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));

    const result = logs.map((log) => ({
        id: log.id,
        action: log.action,
        role: log.role,
        reason: log.reason,
        createdAt: log.createdAt,
        targetUser: profileByUserId.get(log.targetUserId) ?? { userId: log.targetUserId, name: null, email: null },
        admin: profileByUserId.get(log.adminUserId) ?? { userId: log.adminUserId, name: null, email: null },
    }));

    res.json(result);
}
