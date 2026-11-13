import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { getSellerStripeStatus, startSellerStripeOnboarding } from "../controllers/sellerStripe.controller";
import {
    getDashboard,
    getRecentOrders,
} from "../controllers/seller.controller";

const router = Router();

router.use(authenticate, requireRole("SELLER"));

router.get("/dashboard", getDashboard);
router.get("/orders", getRecentOrders);
router.get("/stripe/status", getSellerStripeStatus);
router.post("/stripe/onboarding", startSellerStripeOnboarding);

export default router;
