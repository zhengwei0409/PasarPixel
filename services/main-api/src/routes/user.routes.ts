import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { listUsers, deleteUser } from "../controllers/user.controller";

const router = Router();

router.get("/", authenticate, requireRole("ADMIN"), listUsers);
router.delete("/:userId", authenticate, requireRole("ADMIN"), deleteUser);

export default router;
