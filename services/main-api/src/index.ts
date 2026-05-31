import { config } from "dotenv";
config();

import express from 'express';
import { authenticate, requireRole } from './middleware/auth.middleware';
import { startConsumer } from './lib/consumer';
import profileRoutes from './routes/profile.routes';
import sellerApplicationRoutes from './routes/sellerApplication.routes';
import assetRoutes from './routes/asset.routes';
import cartRoutes from './routes/cart.routes';
import exchangeRateRoutes from './routes/exchangeRate.routes';
import checkoutRoutes from './routes/checkout.routes';
import ordersRoutes from './routes/orders.routes';
import { handleWebhook } from './controllers/checkout.controller';

const app = express();
const PORT = process.env.PORT || 3002;

// Stripe webhook needs the raw body for signature verification, so it must be
// registered BEFORE express.json() (which would otherwise parse the body away).
app.post("/checkout/webhook", express.raw({ type: "application/json" }), handleWebhook);

app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "main-api"});
});

app.use("/profile", profileRoutes);
app.use("/seller-applications", sellerApplicationRoutes);
app.use("/assets", assetRoutes);
app.use("/cart", cartRoutes);
app.use("/exchange-rate", exchangeRateRoutes);
app.use("/checkout", checkoutRoutes);
app.use("/orders", ordersRoutes);

app.get("/test/buyer", authenticate, requireRole("BUYER"), (req, res) => {
    res.json({ message: "Hello, Buyer!", user: req.user });
});

app.get("/test/seller", authenticate, requireRole("SELLER"), (req, res) => {
    res.json({ message: "Hello, Seller!", user: req.user });
});

app.get("/test/admin", authenticate, requireRole("ADMIN"), (req, res) => {
    res.json({ message: "Hello, Admin!", user: req.user });
});

app.listen(PORT, () => {
    console.log(`Main API runnning on port ${PORT}`);
    startConsumer().catch(console.error);
});

