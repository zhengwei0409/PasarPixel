import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { createAsset, updateAsset, getUploadUrl, registerFile, deleteFile, getAssetById, getAssetForReview, getAssetFileDownloadUrl, getMyAssets, getPendingReviewAssets, submitForReview, approveAsset, rejectAsset, deleteOrTakeDownAsset, cancelSubmission, reopenRejected, browseAssets, getPublicAssetById, getRelatedAssets } from "../controllers/asset.controller";
import { getAssetReviews, upsertReview, deleteReview } from "../controllers/review.controller";

const router = Router();

router.get("/browse", browseAssets);
router.get("/browse/:id", getPublicAssetById);
router.get("/browse/:id/related", getRelatedAssets);
router.get("/:id/reviews", getAssetReviews);
router.post("/:id/reviews", authenticate, upsertReview);
router.delete("/:id/reviews", authenticate, deleteReview);
router.post("/", authenticate, requireRole("SELLER"), createAsset);
router.patch("/:id", authenticate, requireRole("SELLER"), updateAsset);
router.get("/mine", authenticate, requireRole("SELLER"), getMyAssets);
router.get("/pending-review", authenticate, requireRole("ADMIN"), getPendingReviewAssets);
router.get("/:id/review", authenticate, requireRole("ADMIN"), getAssetForReview);
router.get("/:id/files/:fileId/download-url", authenticate, requireRole("ADMIN"), getAssetFileDownloadUrl);
router.get("/:id", authenticate, getAssetById);
router.post("/:id/upload-url", authenticate, requireRole("SELLER"), getUploadUrl);
router.post("/:id/files", authenticate, requireRole("SELLER"), registerFile);
router.delete("/:id/files/:fileId", authenticate, requireRole("SELLER"), deleteFile);
router.post("/:id/submit", authenticate, requireRole("SELLER"), submitForReview);
router.patch("/:id/approve", authenticate, requireRole("ADMIN"), approveAsset);
router.patch("/:id/reject", authenticate, requireRole("ADMIN"), rejectAsset);
router.delete("/:id", authenticate, requireRole("SELLER"), deleteOrTakeDownAsset);
router.post("/:id/cancel-submission", authenticate, requireRole("SELLER"), cancelSubmission);
router.post("/:id/reopen", authenticate, requireRole("SELLER"), reopenRejected);

export default router;
