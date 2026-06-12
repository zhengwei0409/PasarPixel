import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { createReport, listReports } from "../controllers/report.controller";

const router = Router();

router.post("/", authenticate, createReport);
router.get("/", authenticate, requireRole("ADMIN"), listReports);

export default router;
