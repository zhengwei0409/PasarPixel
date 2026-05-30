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

    // Create the PENDING order first so the webhook can find it by session id.
    // OrderItems + cart clearing happen in the webhook once payment succeeds.
    const order = await prisma.order.create({
        data: {
            buyerId: userId,
            totalAmount: total,
            paymentStatus: "PENDING",
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
