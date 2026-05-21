import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { submitApplication, getMyApplication } from "../controllers/sellerApplication.controller";

const router = Router();

router.post("/", authenticate, submitApplication);
router.get("/me", authenticate, getMyApplication);

export default router;
