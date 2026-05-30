import Stripe from "stripe";

// Single shared Stripe client (same pattern as lib/prisma.ts). Import this
// everywhere instead of calling `new Stripe(...)` per controller.

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
}

// Pin the API version so Stripe-side upgrades don't silently change behaviour.
export const stripe = new Stripe(secretKey, {
    apiVersion: "2026-05-27.dahlia",
});
