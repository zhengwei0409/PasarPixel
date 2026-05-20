import { Request, Response, NextFunction } from "express";

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:3001";

export interface AuthUser {
    userId: number;
    email: string;
    roles: string[];
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing or invalid Authorization header" });
        return;
    }

    try {
        const response = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
            headers: { authorization: authHeader },
        });

        if (!response.ok) {
            res.status(401).json({ error: "Invalid or expired token" });
            return;
        }

        const user = await response.json() as AuthUser;
        req.user = user;
        next();
    } catch {
        res.status(503).json({ error: "Auth service unavailable" });
    }
}

export function requireRole(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;

        if (!user) {
            res.status(401).json({ error: "Not authenticated" });
            return;
        }

        const hasRole = roles.some((role) => user.roles.includes(role));
        if (!hasRole) {
            res.status(403).json({ error: "Forbidden: insufficient role" });
            return;
        }

        next();
    };
}
