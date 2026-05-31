import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import {
    getMyOrders,
    getMyOrderById,
    getDownloadUrl,
    downloadOrderZip,
} from "../controllers/orders.controller";

const router = Router();

// Public: authorised by a signed token in the query string, not JWT, because the
// browser hits this as a plain download link that can't carry an auth header.
router.get("/:id/download", downloadOrderZip);

router.use(authenticate, requireRole("BUYER"));

router.get("/", getMyOrders);
router.get("/:id", getMyOrderById);
router.get("/:id/download-url", getDownloadUrl);

export default router;
