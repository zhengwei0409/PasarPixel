import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { listRoleLogs } from "../controllers/roleLog.controller";

const router = Router();

router.get("/", authenticate, requireRole("ADMIN"), listRoleLogs);

export default router;
