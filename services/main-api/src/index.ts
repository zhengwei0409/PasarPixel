import { config } from "dotenv";
config();

import express from 'express';
import { authenticate, requireRole } from './middleware/auth.middleware';
import { startConsumer } from './lib/consumer';
import profileRoutes from './routes/profile.routes';
import sellerApplicationRoutes from './routes/sellerApplication.routes';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "main-api"});
});

app.use("/profile", profileRoutes);
app.use("/seller-applications", sellerApplicationRoutes);

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

