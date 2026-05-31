import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { getDashboard } from "../controllers/seller.controller";

const router = Router();

router.use(authenticate, requireRole("SELLER"));

router.get("/dashboard", getDashboard);

export default router;
