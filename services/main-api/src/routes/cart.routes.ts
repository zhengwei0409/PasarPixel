import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { getCart, addToCart, updateCartItemLicense, removeFromCart } from "../controllers/cart.controller";

const router = Router();

router.use(authenticate, requireRole("BUYER"));

router.get("/", getCart);
router.post("/", addToCart);
router.patch("/:id", updateCartItemLicense);
router.delete("/:id", removeFromCart);

export default router;
