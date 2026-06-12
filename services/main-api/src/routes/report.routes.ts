import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { createReport, listReports, resolveReport } from "../controllers/report.controller";

const router = Router();

router.post("/", authenticate, createReport);
router.get("/", authenticate, requireRole("ADMIN"), listReports);
router.patch("/:id/resolve", authenticate, requireRole("ADMIN"), resolveReport);

export default router;
