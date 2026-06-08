import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { listAssetReviewLogs } from "../controllers/assetReviewLog.controller";

const router = Router();

router.get("/", authenticate, requireRole("ADMIN"), listAssetReviewLogs);

export default router;
