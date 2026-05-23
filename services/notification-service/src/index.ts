import { config } from "dotenv";
config();

import express from "express";
import cors from "cors";
import { startConsumers } from "./consumers";
import notificationRoutes from "./routes/notification.routes";

const app = express();
const PORT = 3003;

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'notification-service' });
});

app.use('/notifications', notificationRoutes);

app.listen(PORT, async () => {
    console.log(`Notification service running on port ${PORT}`);
    try {
        await startConsumers();
    } catch (err) {
        console.error('Failed to start consumers:', err);
    }
});
