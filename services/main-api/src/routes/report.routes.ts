import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { createReport } from "../controllers/report.controller";

const router = Router();

router.post("/", authenticate, createReport);

export default router;
