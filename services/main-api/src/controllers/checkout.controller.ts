import { Request, Response } from "express";
import { Currency, LicenseType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";
import { convert } from "../lib/currency";

const SUPPORTED_CURRENCIES: Currency[] = ["USD", "MYR"];

// Stripe wants the smallest currency unit (cents). RM 10.00 -> 1000.
function toStripeAmount(amount: number): number {
    return Math.round(amount * 100);
}

function priceForLicense(
    asset: { pricePersonal: unknown; priceCommercial: unknown },
    licenseType: LicenseType,
): number | null {
    const raw = licenseType === "PERSONAL" ? asset.pricePersonal : asset.priceCommercial;
    if (raw === null || raw === undefined) return null;
    const n = Number(raw); // Prisma Decimal -> number
    return Number.isFinite(n) ? n : null;
}

export async function createCheckoutSession(req: Request, res: Response) {
    const userId = req.user!.userId;

    const currency = String(req.body.currency ?? "").toUpperCase() as Currency;
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
        res.status(400).json({ error: "currency must be USD or MYR" });
        return;
    }

    const cartItems = await prisma.cartItem.findMany({
        where: { userId },
        include: { asset: true },
    });

    if (cartItems.length === 0) {
        res.status(400).json({ error: "Cart is empty" });
        return;
    }

    // Build Stripe line items. Prices come from the DB (never trust the client),
    // converted into the buyer's chosen currency.
    const lineItems: {
        quantity: number;
        price_data: {
            currency: string;
            unit_amount: number;
            product_data: { name: string };
        };
    }[] = [];

    // Snapshot of each priced item, used to create OrderItems with prices locked
    // in at checkout time (so later cart/rate changes don't affect this order).
    const orderItemsData: {
        assetId: number;
        licenseType: LicenseType;
        price: number;
    }[] = [];

    let total = 0;

    for (const item of cartItems) {
        const asset = item.asset;

        if (asset.status !== "PUBLISHED" || asset.isDeleted) {
            res.status(409).json({
                error: `"${asset.title}" is no longer available`,
            });
            return;
        }

        const priceInAssetCurrency = priceForLicense(asset, item.licenseType);
        if (priceInAssetCurrency === null) {
            res.status(409).json({
                error: `"${asset.title}" has no ${item.licenseType} price`,
            });
            return;
        }

        const price = await convert(priceInAssetCurrency, asset.currency, currency);
        total += price;

        orderItemsData.push({
            assetId: asset.id,
            licenseType: item.licenseType,
            price,
        });

        lineItems.push({
            quantity: 1,
            price_data: {
                currency: currency.toLowerCase(),
                unit_amount: toStripeAmount(price),
                product_data: {
                    name: `${asset.title} (${item.licenseType} license)`,
                },
            },
        });
    }

    // Create the PENDING order with its items in one transaction. Prices are
    // locked in now; the webhook only flips PENDING -> COMPLETED and clears the cart.
    const order = await prisma.order.create({
        data: {
            buyerId: userId,
            // Round to 2dp: summing floats (e.g. 60 + 39.65) can leave a 0.0000001 tail.
            totalAmount: Math.round(total * 100) / 100,
            paymentStatus: "PENDING",
            orderItems: { create: orderItemsData },
        },
    });

    const clientUrl = process.env.CLIENT_URL ?? "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        success_url: `${clientUrl}/checkout/success?orderId=${order.id}`,
        cancel_url: `${clientUrl}/cart`,
        metadata: {
            orderId: String(order.id),
            buyerId: String(userId),
        },
    });

    // Remember which Stripe session this order belongs to.
    await prisma.order.update({
        where: { id: order.id },
        data: { stripePaymentId: session.id },
    });

    res.json({ url: session.url });
}

// Stripe calls this when payment events happen. It must receive the RAW request
// body (see index.ts) so the signature check works.
export async function handleWebhook(req: Request, res: Response) {
    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error("STRIPE_WEBHOOK_SECRET is not set");
        res.status(500).send("Webhook not configured");
        return;
    }

    let event;
    try {
        // Verifies the request really came from Stripe (and wasn't tampered with).
        event = stripe.webhooks.constructEvent(
            req.body, // raw Buffer
            signature as string,
            webhookSecret,
        );
    } catch (err) {
        console.error("Webhook signature verification failed:", (err as Error).message);
        res.status(400).send("Invalid signature");
        return;
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object as { metadata?: { orderId?: string } };
        const orderId = Number(session.metadata?.orderId);

        if (!Number.isInteger(orderId)) {
            console.error("Webhook missing valid orderId in metadata");
            res.status(400).send("Missing orderId");
            return;
        }

        const order = await prisma.order.findUnique({ where: { id: orderId } });

        // Idempotent: Stripe may resend the same event. Skip if already handled.
        if (order && order.paymentStatus === "PENDING") {
            await prisma.order.update({
                where: { id: orderId },
                data: { paymentStatus: "COMPLETED" },
            });
            // Payment succeeded — empty the buyer's cart.
            await prisma.cartItem.deleteMany({ where: { userId: order.buyerId } });
        }
    }

    // Always 200 so Stripe stops retrying.
    res.json({ received: true });
}
