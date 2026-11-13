import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

// Adds `userId` to the request object so downstream handlers can read it.
export interface AuthedRequest extends Request {
    userId?: number;
}

// Gatekeeper middleware: verifies the Bearer access token, extracts the user id,
// and attaches it to the request. Blocks the request if the token is missing or invalid.
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing or invalid Authorization header" });
        return;
    }

    const token = authHeader.split(" ")[1];

    let payload: { sub: number; purpose?: unknown; sessionVersion?: number };
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET!) as unknown as typeof payload;
        if (payload.purpose !== undefined || !Number.isSafeInteger(payload.sub) || payload.sub <= 0) {
            res.status(401).json({ error: "Invalid access token" });
            return;
        }
    } catch {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }

    const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { suspendedAt: true, sessionVersion: true },
    });
    if (!user || user.suspendedAt || user.sessionVersion !== (payload.sessionVersion ?? 0)) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }
    req.userId = payload.sub;
    next();
}
