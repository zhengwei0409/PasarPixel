import "dotenv/config";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";
import { configuredCoreGateway } from "./lib/coreMint";
import { masterMintService } from "./services/masterMint.service";
import { configuredPurchaseGateway } from "./lib/purchaseGateway";
import { purchaseService } from "./services/purchase.service";

const clientUrl = new URL(process.env.CLIENT_URL || "http://localhost:5173");
if (!["http:", "https:"].includes(clientUrl.protocol) || clientUrl.username || clientUrl.password ||
    clientUrl.pathname !== "/" || clientUrl.search || clientUrl.hash ||
    (process.env.NODE_ENV === "production" && clientUrl.protocol !== "https:")) {
    throw new Error("CLIENT_URL must be the frontend origin (HTTPS in production)");
}
if (process.env.NODE_ENV === "production" && !process.env.CLIENT_URL) throw new Error("CLIENT_URL is required");
const port = Number(process.env.PORT || 3004);
const authServiceUrl = process.env.AUTH_SERVICE_URL || "http://localhost:3001";

async function start() {
    await prisma.$connect();
    const options = { gateway: configuredCoreGateway(), purchaseGateway: configuredPurchaseGateway(), internalToken: process.env.INTERNAL_SERVICE_TOKEN, clientOrigin: clientUrl.origin,
        mainApiUrl: process.env.MAIN_API_URL || "http://localhost:3002",
        publicApiUrl: (process.env.PUBLIC_API_URL || (process.env.NODE_ENV === "production" ? `${clientUrl.origin}/api` : "http://localhost:8000")).replace(/\/$/, "") };
    const mints = masterMintService(prisma, options);
    const purchases = purchaseService(prisma, { ...options, gateway: options.purchaseGateway });
    let stopping = false;
    const work = async () => {
        try { await mints.tick(); } catch { console.error("Mint reconciliation will retry"); }
        try { await purchases.tick(); } catch { console.error("Purchase reconciliation will retry"); }
        if (!stopping) timer = setTimeout(() => void work(), 5000);
    };
    let timer: ReturnType<typeof setTimeout>;
    void work();
    const server = createApp(prisma, authServiceUrl, clientUrl.origin, options).listen(port, () => {
        console.log(`Blockchain service running on port ${port} (Solana Devnet)`);
    });
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.once(signal, () => {
            stopping = true;
            clearTimeout(timer);
            server.close(() => { void prisma.$disconnect().then(() => process.exit(0)); });
            setTimeout(() => process.exit(1), 10_000).unref();
        });
    }
}
start().catch(() => { console.error("Unable to start blockchain service; check database configuration"); process.exit(1); });
