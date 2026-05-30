import { Request, Response } from "express";
import { getRate } from "../lib/currency";

const SUPPORTED = ["USD", "MYR"];

// Public endpoint. Returns the current rate so the frontend can convert prices
// for display using a real rate instead of a hardcoded fallback.
export async function getExchangeRate(req: Request, res: Response) {
    const from = String(req.query.from ?? "").toUpperCase();
    const to = String(req.query.to ?? "").toUpperCase();

    if (!SUPPORTED.includes(from) || !SUPPORTED.includes(to)) {
        res.status(400).json({ error: `from/to must be one of ${SUPPORTED.join(", ")}` });
        return;
    }

    try {
        const rate = await getRate(from, to);
        res.json({ from, to, rate });
    } catch {
        res.status(502).json({ error: "Failed to fetch exchange rate" });
    }
}
