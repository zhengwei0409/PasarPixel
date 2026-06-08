import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { submitApplication, getMyApplication, listApplications, approveApplication, rejectApplication, revokeSeller, reinstateSeller, getIdDocumentUploadUrl, getApplication, getIdDocumentDownloadUrl } from "../controllers/sellerApplication.controller";

const router = Router();

router.post("/", authenticate, submitApplication);
router.post("/id-document/upload-url", authenticate, getIdDocumentUploadUrl);
router.get("/me", authenticate, getMyApplication);

router.get("/", authenticate, requireRole("ADMIN"), listApplications);
router.get("/:id", authenticate, requireRole("ADMIN"), getApplication);
router.get("/:id/id-document", authenticate, requireRole("ADMIN"), getIdDocumentDownloadUrl);
router.patch("/:id/approve", authenticate, requireRole("ADMIN"), approveApplication);
router.patch("/:id/reject", authenticate, requireRole("ADMIN"), rejectApplication);
router.post("/sellers/:userId/revoke", authenticate, requireRole("ADMIN"), revokeSeller);
router.post("/sellers/:userId/reinstate", authenticate, requireRole("ADMIN"), reinstateSeller);

export default router;
