import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { listUsers, deleteUser } from "../controllers/user.controller";
import { getAdminUserDetail } from "../controllers/adminUserDetail.controller";

const router = Router();

router.get("/", authenticate, requireRole("ADMIN"), listUsers);
router.get("/:userId", authenticate, requireRole("ADMIN"), getAdminUserDetail);
router.delete("/:userId", authenticate, requireRole("ADMIN"), deleteUser);

export default router;
