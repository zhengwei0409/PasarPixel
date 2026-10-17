import type { Request, Response, NextFunction } from "express";

declare global {
    namespace Express {
        interface Request { user?: { userId: number; email: string; roles: string[] } }
    }
}

export function authenticate(authServiceUrl: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const authorization = req.headers.authorization;
        if (!authorization || !/^Bearer \S+$/.test(authorization)) {
            res.status(401).json({ error: "Sign in to manage your wallet" });
            return;
        }
        try {
            const response = await fetch(`${authServiceUrl}/auth/me`, {
                headers: { authorization }, signal: AbortSignal.timeout(5000),
            });
            if (response.status === 401 || response.status === 403) {
                res.status(response.status).json({ error: "Your session has expired. Please sign in again." });
                return;
            }
            if (!response.ok) throw new Error("Auth service unavailable");
            const user = await response.json();
            if (!Number.isSafeInteger(user.userId) || user.userId <= 0 || !Array.isArray(user.roles)) {
                throw new Error("Invalid auth response");
            }
            req.user = user;
            next();
        } catch {
            res.status(503).json({ error: "Unable to verify your session. Please try again." });
        }
    };
}
