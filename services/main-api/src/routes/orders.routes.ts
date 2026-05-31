import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import {
    getMyOrders,
    getMyOrderById,
    getDownloadUrl,
    downloadOrderZip,
    verifyLicense,
} from "../controllers/orders.controller";

const router = Router();

// Public: anyone can verify a licence key on the /verify page — no JWT (FR-3.5).
// Kept above the authenticate middleware and on its own /verify/ path so it
// doesn't collide with the GET /:id route below.
router.get("/verify/:licenseKey", verifyLicense);

// Public: authorised by a signed token in the query string, not JWT, because the
// browser hits this as a plain download link that can't carry an auth header.
router.get("/:id/download", downloadOrderZip);

router.use(authenticate, requireRole("BUYER"));

router.get("/", getMyOrders);
router.get("/:id", getMyOrderById);
router.get("/:id/download-url", getDownloadUrl);

export default router;
