import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Adds `userId` to the request object so downstream handlers can read it.
export interface AuthedRequest extends Request {
    userId?: number;
}

// Gatekeeper middleware: verifies the Bearer access token, extracts the user id,
// and attaches it to the request. Blocks the request if the token is missing or invalid.
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing or invalid Authorization header" });
        return;
    }

    const token = authHeader.split(" ")[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as unknown as {
            sub: number;
        };
        req.userId = payload.sub;
        next();
    } catch {
        res.status(401).json({ error: "Invalid or expired token" });
    }
}
