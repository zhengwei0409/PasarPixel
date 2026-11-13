import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { getDashboardStats } from "../controllers/dashboard.controller";
import { listAdminTransactions } from "../controllers/adminTransactions.controller";

import { listAdminAssets, takeDownAdminAsset } from "../controllers/adminAssets.controller";

const router = Router();

router.patch("/assets/:id/take-down", authenticate, requireRole("ADMIN"), takeDownAdminAsset);

router.get("/assets", authenticate, requireRole("ADMIN"), listAdminAssets);

router.get("/stats", authenticate, requireRole("ADMIN"), getDashboardStats);
router.get("/transactions", authenticate, requireRole("ADMIN"), listAdminTransactions);

export default router;
