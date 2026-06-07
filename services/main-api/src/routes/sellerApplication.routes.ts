import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { submitApplication, getMyApplication, listApplications, approveApplication, rejectApplication, revokeSeller, reinstateSeller } from "../controllers/sellerApplication.controller";

const router = Router();

router.post("/", authenticate, submitApplication);
router.get("/me", authenticate, getMyApplication);

router.get("/", authenticate, requireRole("ADMIN"), listApplications);
router.patch("/:id/approve", authenticate, requireRole("ADMIN"), approveApplication);
router.patch("/:id/reject", authenticate, requireRole("ADMIN"), rejectApplication);
router.post("/sellers/:userId/revoke", authenticate, requireRole("ADMIN"), revokeSeller);
router.post("/sellers/:userId/reinstate", authenticate, requireRole("ADMIN"), reinstateSeller);

export default router;
