import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import {
    getStore,
    getStoreAssets,
    getMyStore,
    updateMyStore,
    getStoreImageUploadUrl,
    updateStoreImage,
} from "../controllers/store.controller";

const router = Router();

// Seller-owned routes first so "me" isn't captured by the :sellerId param.
router.get("/me", authenticate, requireRole("SELLER"), getMyStore);
router.patch("/me", authenticate, requireRole("SELLER"), updateMyStore);
router.post("/me/:kind/upload-url", authenticate, requireRole("SELLER"), getStoreImageUploadUrl);
router.patch("/me/:kind", authenticate, requireRole("SELLER"), updateStoreImage);

// Public shop profile.
router.get("/:sellerId", getStore);
router.get("/:sellerId/assets", getStoreAssets);

export default router;
