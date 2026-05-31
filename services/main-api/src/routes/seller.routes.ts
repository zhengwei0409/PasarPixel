import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import {
    getDashboard,
    getMyWithdrawals,
    requestWithdrawal,
} from "../controllers/seller.controller";

const router = Router();

router.use(authenticate, requireRole("SELLER"));

router.get("/dashboard", getDashboard);
router.get("/withdrawals", getMyWithdrawals);
router.post("/withdrawals", requestWithdrawal);

export default router;
