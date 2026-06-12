import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { getDashboardStats } from "../controllers/dashboard.controller";

const router = Router();

router.get("/stats", authenticate, requireRole("ADMIN"), getDashboardStats);

export default router;
