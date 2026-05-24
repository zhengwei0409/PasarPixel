import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { createAsset } from "../controllers/asset.controller";

const router = Router();

router.post("/", authenticate, requireRole("SELLER"), createAsset);

export default router;
