import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { createAsset, getUploadUrl } from "../controllers/asset.controller";

const router = Router();

router.post("/", authenticate, requireRole("SELLER"), createAsset);
router.post("/:id/upload-url", authenticate, requireRole("SELLER"), getUploadUrl);

export default router;
