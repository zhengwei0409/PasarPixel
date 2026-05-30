import { Router } from "express";
import { getExchangeRate } from "../controllers/exchangeRate.controller";

const router = Router();

// Public — no auth. Prices are shown to anonymous visitors too.
router.get("/", getExchangeRate);

export default router;
