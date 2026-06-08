import { Router } from "express";
import roleLogRoutes from "./roleLog.routes";
import assetReviewLogRoutes from "./assetReviewLog.routes";

// All admin log feeds live under one prefix (/logs). Add future log types here.
const router = Router();

router.use("/roles", roleLogRoutes);
router.use("/asset-reviews", assetReviewLogRoutes);

export default router;
