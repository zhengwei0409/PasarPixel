import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getMyProfile, updateMyProfile } from "../controllers/profile.controller";

const router = Router();

router.get("/me", authenticate, getMyProfile);
router.patch("/me", authenticate, updateMyProfile);

export default router;
