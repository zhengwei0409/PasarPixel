import express, { type ErrorRequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import type { PrismaClient } from "../generated/client";
import { authenticate } from "./middleware/auth.middleware";
import { HttpError } from "./lib/errors";
import { walletService } from "./services/wallet.service";

export function createApp(db: PrismaClient, authServiceUrl: string, clientOrigin: string) {
    const app = express();
    const wallets = walletService(db, clientOrigin);
    app.disable("x-powered-by");
    app.use(express.json({ limit: "8kb" }));
    const health = async (_req: express.Request, res: express.Response) => {
        try {
            await db.$queryRaw`SELECT 1`;
            res.json({ status: "ok", service: "blockchain-service", network: "solana:devnet" });
        } catch {
            res.status(503).json({ status: "unavailable", service: "blockchain-service" });
        }
    };
    app.get("/health", health);
    app.get("/blockchain/health", health);
    app.use("/blockchain", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); }, authenticate(authServiceUrl));
    const limit = rateLimit({
        windowMs: 60_000, limit: 10,
        keyGenerator: (req) => String(req.user!.userId),
        standardHeaders: "draft-8", legacyHeaders: false,
        message: { error: "Too many wallet attempts. Please wait a minute and try again." },
    });
    app.get("/blockchain/wallet", async (req, res) => {
        res.json(await wallets.getStatus(req.user!.userId));
    });
    app.post("/blockchain/wallet/challenge", limit, async (req, res) => {
        res.status(201).json(await wallets.createChallenge(req.user!.userId, req.body?.address));
    });
    app.post("/blockchain/wallet/verify", limit, async (req, res) => {
        res.json(await wallets.bind(req.user!.userId, req.body?.challengeId, req.body?.signature));
    });
    app.use((_req, res) => { res.status(404).json({ error: "Not found" }); });
    const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
        if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
        if (error.type === "entity.parse.failed" || error.type === "entity.too.large") {
            res.status(error.status).json({ error: "Invalid request body" }); return;
        }
        console.error("Blockchain request failed", error.code ?? error.name);
        res.status(500).json({ error: "Unable to manage your wallet. Please try again." });
    };
    app.use(errorHandler);
    return app;
}
