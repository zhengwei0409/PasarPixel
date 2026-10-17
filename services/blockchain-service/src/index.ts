import "dotenv/config";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";

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
    const server = createApp(prisma, authServiceUrl, clientUrl.origin).listen(port, () => {
        console.log(`Blockchain service running on port ${port} (Solana Devnet)`);
    });
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.once(signal, () => {
            server.close(() => { void prisma.$disconnect().then(() => process.exit(0)); });
            setTimeout(() => process.exit(1), 10_000).unref();
        });
    }
}
start().catch(() => { console.error("Unable to start blockchain service; check database configuration"); process.exit(1); });
