import { config } from "dotenv";
config();

import express from "express";
import cors from "cors";

const app = express();
const PORT = 3003;

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'notification-service' });
});

app.listen(PORT, () => {
    console.log(`Notification service running on port ${PORT}`);
});
