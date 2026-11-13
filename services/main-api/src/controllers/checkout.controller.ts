import { Request, Response } from "express";
import { Currency, LicenseType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { canAcceptStripeCards, isStripeSandbox, stripe } from "../lib/stripe";
import { convert } from "../lib/currency";
import { publishOrderPaid, publishAssetSold } from "../lib/publisher";

const SUPPORTED_CURRENCIES: Currency[] = ["USD", "MYR"];

// Stripe wants the smallest currency unit (cents). RM 10.00 -> 1000.
function toStripeAmount(amount: number): number {
    return Math.round(amount * 100);
}

// Marks a paid order COMPLETED and removes its purchased assets from the cart. Idempotent: only
// acts on a PENDING order, so it's safe to call from both the webhook and the
// success-page verify endpoint (whichever arrives first wins; the other no-ops).
async function fulfilOrder(orderId: number): Promise<void> {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { orderItems: { include: { asset: true } } },
    });
    if (!order || order.paymentStatus !== "PENDING" || order.paymentMethod === "SOL") return;

    const completed = await prisma.order.updateMany({
        where: { id: orderId, paymentStatus: "PENDING" },
        data: { paymentStatus: "COMPLETED" },
    });
    if (completed.count === 0) return;
    await prisma.cartItem.deleteMany({
        where: {
            userId: order.buyerId,
            OR: order.orderItems.map((item) => ({
                assetId: item.assetId,
                licenseType: item.licenseType,
            })),
        },
    });

    // Notify the buyer that their order went through.
    await publishOrderPaid({
        buyerId: order.buyerId,
        orderId: order.id,
        itemCount: order.orderItems.length,
    });

    // Notify each seller about the asset they sold (one event per item).
    for (const item of order.orderItems) {
        await publishAssetSold({
            sellerId: item.asset.sellerId,
            assetId: item.assetId,
            assetTitle: item.asset.title,
            orderId: order.id,
        });
    }
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

    // An explicit selection must be nonempty and belong to this buyer's cart.
    const requestedIds: unknown = req.body.cartItemIds;
    if (requestedIds !== undefined && (
        !Array.isArray(requestedIds) || requestedIds.length === 0 ||
        !requestedIds.every((id) => typeof id === "number" && Number.isSafeInteger(id) && id > 0)
    )) {
        res.status(400).json({ error: "cartItemIds must be a nonempty array of positive integer IDs" });
        return;
    }
    const cartItemIds = requestedIds === undefined ? undefined : [...new Set(requestedIds as number[])];

    const cartItems = await prisma.cartItem.findMany({
        where: { userId, ...(cartItemIds ? { id: { in: cartItemIds } } : {}) },
        include: { asset: true },
    });

    if (cartItemIds && cartItems.length !== cartItemIds.length) {
        res.status(409).json({ error: "Some selected assets are no longer in your cart. Refresh your cart and try again." });
        return;
    }

    if (cartItems.length === 0) {
        res.status(400).json({ error: "Cart is empty" });
        return;
    }

    const sellerIds = new Set(cartItems.map(({ asset }) => asset.sellerId));
    if (sellerIds.size !== 1) {
        res.status(409).json({ error: "Pay for items from one seller at a time." });
        return;
    }
    if (!isStripeSandbox) {
        res.status(503).json({ error: "Seller checkout requires a Stripe Sandbox API key." });
        return;
    }
    const sellerId = cartItems[0].asset.sellerId;
    const connected = await prisma.sellerStripeAccount.findUnique({
        where: { sellerId }, select: { stripeAccountId: true },
    });
    const accountId = connected?.stripeAccountId;
    if (!accountId) {
        res.status(409).json({ error: "This seller hasn't set up Stripe payments yet." });
        return;
    }
    try {
        const account = await stripe.accounts.retrieve(accountId);
        if (!canAcceptStripeCards(account)) {
            res.status(409).json({ error: "This seller is still setting up Stripe payments." });
            return;
        }
    } catch (error) {
        console.error("Could not verify seller Stripe account", { sellerId, error: (error as Error).name });
        res.status(502).json({ error: "Could not verify this seller’s payment setup. Try again." });
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

        if (asset.listingType === "BLOCKCHAIN" || asset.status !== "PUBLISHED" || asset.isDeleted || asset.hiddenByRevoke) {
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
    // locked in now; fulfilment removes only the purchased assets from the cart.
    const order = await prisma.order.create({
        data: {
            buyerId: userId,
            // Round to 2dp: summing floats (e.g. 60 + 39.65) can leave a 0.0000001 tail.
            totalAmount: Math.round(total * 100) / 100,
            currency, // lock in the currency the buyer paid in
            paymentStatus: "PENDING",
            stripeConnectedAccountId: accountId,
            orderItems: { create: orderItemsData },
        },
    });

    const clientUrl = process.env.CLIENT_URL ?? "http://localhost:5173";

    let session;
    try {
        session = await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: lineItems,
            success_url: `${clientUrl}/checkout/success?orderId=${order.id}`,
            cancel_url: `${clientUrl}/cart`,
            metadata: {
                orderId: String(order.id),
                buyerId: String(userId),
            },
        }, { stripeAccount: accountId });
    } catch (error) {
        await prisma.order.updateMany({ where: { id: order.id, paymentStatus: "PENDING" }, data: { paymentStatus: "FAILED" } });
        console.error("Unable to start seller checkout", { orderId: order.id, error: (error as Error).name });
        res.status(502).json({ error: "Stripe could not start this seller’s checkout. Check that their Stripe account can accept payments." });
        return;
    }

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
    const platformSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const connectSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || platformSecret;

    if (!platformSecret && !connectSecret) {
        console.error("STRIPE_WEBHOOK_SECRET is not set");
        res.status(500).send("Webhook not configured");
        return;
    }

    let event: ReturnType<typeof stripe.webhooks.constructEvent> | undefined;
    for (const secret of new Set([platformSecret, connectSecret])) {
        if (!secret || typeof signature !== "string") continue;
        try {
            const verified = stripe.webhooks.constructEvent(req.body, signature, secret);
            if (secret === (verified.account ? connectSecret : platformSecret)) {
                event = verified;
                break;
            }
        } catch {
            // Platform and Connect endpoints may have different signing secrets.
        }
    }
    if (!event) {
        res.status(400).send("Invalid signature");
        return;
    }

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded"
        || event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
        const session = event.data.object;
        const orderId = Number(session.metadata?.orderId);

        if (Number.isInteger(orderId) && orderId > 0 && orderId <= 2_147_483_647) {
            const order = await prisma.order.findUnique({
                where: { id: orderId }, select: { stripePaymentId: true, stripeConnectedAccountId: true },
            });
            if (order && order.stripePaymentId === session.id && (order.stripeConnectedAccountId ?? null) === (event.account ?? null)) {
                if (session.payment_status === "paid") await fulfilOrder(orderId);
                else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
                    await prisma.order.updateMany({ where: { id: orderId, paymentStatus: "PENDING" }, data: { paymentStatus: "FAILED" } });
                }
            }
        }
    }

    res.json({ received: true });
}

// GET /checkout/verify/:orderId — called by the success page so the buyer
// doesn't have to wait for the (async, possibly slow) webhook. Confirms with
// Stripe that the session was actually paid before fulfilling. Returns the
// current payment status either way.
export async function verifyCheckout(req: Request, res: Response) {
    const userId = req.user!.userId;
    const orderId = parseInt(req.params.orderId as string);
    if (isNaN(orderId)) {
        res.status(400).json({ error: "Invalid order id" });
        return;
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.buyerId !== userId) {
        res.status(404).json({ error: "Order not found" });
        return;
    }

    // Already settled (e.g. webhook beat us here) — just report it.
    if (order.paymentStatus !== "PENDING") {
        res.json({ paymentStatus: order.paymentStatus });
        return;
    }

    // Ask Stripe directly whether this session was paid. Never trust the client.
    if (order.stripePaymentId) {
        const options = order.stripeConnectedAccountId ? { stripeAccount: order.stripeConnectedAccountId } : {};
        const session = await stripe.checkout.sessions.retrieve(order.stripePaymentId, {}, options);
        if (session.payment_status === "paid") {
            await fulfilOrder(orderId);
            res.json({ paymentStatus: "COMPLETED" });
            return;
        }
        if (session.status === "expired") {
            await prisma.order.updateMany({ where: { id: orderId, paymentStatus: "PENDING" }, data: { paymentStatus: "FAILED" } });
            res.json({ paymentStatus: "FAILED" });
            return;
        }
    }

    res.json({ paymentStatus: order.paymentStatus });
}
