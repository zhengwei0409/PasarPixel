import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { createAsset, getUploadUrl, registerFile, deleteFile, getAssetById } from "../controllers/asset.controller";

const router = Router();

router.post("/", authenticate, requireRole("SELLER"), createAsset);
router.get("/:id", authenticate, getAssetById);
router.post("/:id/upload-url", authenticate, requireRole("SELLER"), getUploadUrl);
router.post("/:id/files", authenticate, requireRole("SELLER"), registerFile);
router.delete("/:id/files/:fileId", authenticate, requireRole("SELLER"), deleteFile);

export default router;
