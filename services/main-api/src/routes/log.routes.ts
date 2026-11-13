import { Router } from "express";
import roleLogRoutes from "./roleLog.routes";
import assetReviewLogRoutes from "./assetReviewLog.routes";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { exportActivityLogs, listActivityLogs } from "../controllers/activityLog.controller";

// All admin log feeds live under one prefix (/logs). Add future log types here.
const router = Router();

router.use("/roles", roleLogRoutes);
router.use("/asset-reviews", assetReviewLogRoutes);
router.get("/activity", authenticate, requireRole("ADMIN"), listActivityLogs);
router.get("/activity/export", authenticate, requireRole("ADMIN"), exportActivityLogs);

export default router;
