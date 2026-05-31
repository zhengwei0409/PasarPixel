import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { getMyOrders, getMyOrderById } from "../controllers/orders.controller";

const router = Router();

router.use(authenticate, requireRole("BUYER"));

router.get("/", getMyOrders);
router.get("/:id", getMyOrderById);

export default router;
