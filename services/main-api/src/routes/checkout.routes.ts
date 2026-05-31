import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { createCheckoutSession, verifyCheckout } from "../controllers/checkout.controller";

const router = Router();

router.use(authenticate, requireRole("BUYER"));

router.post("/", createCheckoutSession);
router.get("/verify/:orderId", verifyCheckout);

export default router;
