import axios from "axios";
import type { Request, Response } from "express";
import type { AdminAccount } from "../../../../shared/types/adminAccount";

// Auth owns account roles. Stop before changing anything if it cannot verify the target.
export async function requireNonAdminAccount(req: Request, res: Response, userId: number): Promise<boolean> {
    const authUrl = (process.env.AUTH_SERVICE_URL || "http://localhost:3001").replace(/\/$/, "");
    try {
        const { data } = await axios.get<AdminAccount>(`${authUrl}/auth/admin/accounts/${userId}`, {
            headers: { authorization: req.headers.authorization },
            timeout: 10_000,
        });
        if (data.userId !== userId || !Array.isArray(data.roles)) {
            res.status(503).json({ error: "Unable to verify the target account. Please try again." });
            return false;
        }
        if (data.roles.includes("ADMIN")) {
            res.status(403).json({ error: "Admin accounts cannot be modified or deleted by another admin" });
            return false;
        }
        return true;
    } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status === 404) {
            res.status(404).json({ error: "User not found" });
        } else if (status === 401 || status === 403) {
            res.status(status).json({ error: "Unable to authorize the account request" });
        } else {
            res.status(503).json({ error: "Unable to verify the target account. Please try again." });
        }
        return false;
    }
}
