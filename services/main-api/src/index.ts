import { config } from "dotenv";
config();

import express from 'express';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "main-api"});
});

app.listen(PORT, () => {
    console.log(`Main API runnning on port ${PORT}`);
});

