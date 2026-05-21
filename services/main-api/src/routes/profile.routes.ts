import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getMyProfile } from "../controllers/profile.controller";

const router = Router();

router.get("/me", authenticate, getMyProfile);

export default router;
