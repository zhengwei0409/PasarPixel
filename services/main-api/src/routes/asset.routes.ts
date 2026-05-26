import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { createAsset, getUploadUrl, registerFile, deleteFile, getAssetById, getMyAssets, submitForReview, approveAsset, rejectAsset } from "../controllers/asset.controller";

const router = Router();

router.post("/", authenticate, requireRole("SELLER"), createAsset);
router.get("/mine", authenticate, requireRole("SELLER"), getMyAssets);
router.get("/:id", authenticate, getAssetById);
router.post("/:id/upload-url", authenticate, requireRole("SELLER"), getUploadUrl);
router.post("/:id/files", authenticate, requireRole("SELLER"), registerFile);
router.delete("/:id/files/:fileId", authenticate, requireRole("SELLER"), deleteFile);
router.post("/:id/submit", authenticate, requireRole("SELLER"), submitForReview);
router.patch("/:id/approve", authenticate, requireRole("ADMIN"), approveAsset);
router.patch("/:id/reject", authenticate, requireRole("ADMIN"), rejectAsset);

export default router;
