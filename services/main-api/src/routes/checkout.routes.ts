import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { createCheckoutSession } from "../controllers/checkout.controller";

const router = Router();

router.use(authenticate, requireRole("BUYER"));

router.post("/", createCheckoutSession);

export default router;
