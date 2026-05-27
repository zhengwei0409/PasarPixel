import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getMyProfile, updateMyProfile, getAvatarUploadUrl, updateAvatar, deleteAvatar } from "../controllers/profile.controller";

const router = Router();

router.get("/me", authenticate, getMyProfile);
router.patch("/me", authenticate, updateMyProfile);
router.post("/avatar/upload-url", authenticate, getAvatarUploadUrl);
router.patch("/avatar", authenticate, updateAvatar);
router.delete("/avatar", authenticate, deleteAvatar);

export default router;
