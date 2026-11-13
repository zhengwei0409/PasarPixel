import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { canAcceptStripeCards, isStripeSandbox, stripe } from "../lib/stripe";

export async function getSellerStripeStatus(req: Request, res: Response) {
    res.set("Cache-Control", "no-store");
    if (!isStripeSandbox) {
        res.json({ status: "unavailable" });
        return;
    }

    const sellerId = req.user!.userId;
    const connected = await prisma.sellerStripeAccount.findUnique({
        where: { sellerId },
        select: { stripeAccountId: true },
    });
    if (!connected) {
        res.json({ status: "not_connected" });
        return;
    }

    try {
        const account = await stripe.accounts.retrieve(connected.stripeAccountId);
        res.json({ status: canAcceptStripeCards(account) ? "ready" : "needs_onboarding" });
    } catch (error) {
        console.error("Unable to read seller Stripe account", { sellerId, error: (error as Error).name });
        res.status(502).json({ error: "Could not check your Stripe account. Try again." });
    }
}

export async function startSellerStripeOnboarding(req: Request, res: Response) {
    res.set("Cache-Control", "no-store");
    if (!isStripeSandbox) {
        res.status(503).json({ error: "Stripe onboarding requires a Sandbox API key." });
        return;
    }

    const sellerId = req.user!.userId;
    const seller = await prisma.userProfile.findUnique({
        where: { userId: sellerId },
        select: { stripeAccount: { select: { stripeAccountId: true } }, createdAt: true },
    });
    if (!seller) {
        res.status(404).json({ error: "Seller profile not found." });
        return;
    }

    const settingsUrl = new URL("/settings#stripe-payments", process.env.CLIENT_URL || "http://localhost:5173");
    const refreshUrl = new URL(settingsUrl);
    refreshUrl.searchParams.set("stripe", "refresh");

    try {
        let accountId = seller.stripeAccount?.stripeAccountId;
        if (!accountId) {
            // Stripe returns the same account when a request is retried or two tabs start at once.
            const platform = await stripe.accounts.retrieve(null);
            if (!platform.country) throw new Error("Stripe Sandbox account has no country.");
            const account = await stripe.v2.core.accounts.create({
                dashboard: "full",
                identity: { country: platform.country.toLowerCase() },
                defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
                configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
                metadata: { pasarpixel_seller_id: String(sellerId) },
            }, { idempotencyKey: `pasarpixel-seller-merchant-${sellerId}-${seller.createdAt.getTime()}` });

            await prisma.sellerStripeAccount.createMany({
                data: { sellerId, stripeAccountId: account.id },
                skipDuplicates: true,
            });
            const saved = await prisma.sellerStripeAccount.findUnique({
                where: { sellerId }, select: { stripeAccountId: true },
            });
            accountId = saved?.stripeAccountId;
            if (!accountId) {
                res.status(409).json({ error: "Could not save your Stripe account. Try again." });
                return;
            }
        }

        const link = await stripe.v2.core.accountLinks.create({
            account: accountId,
            use_case: {
                type: "account_onboarding",
                account_onboarding: {
                    configurations: ["merchant"],
                    return_url: settingsUrl.toString(),
                    refresh_url: refreshUrl.toString(),
                },
            },
        });
        res.json({ url: link.url });
    } catch (error) {
        const details = error as { name?: string; type?: string; code?: string; requestId?: string };
        console.error("Unable to start seller Stripe onboarding", {
            sellerId,
            error: details.type ?? details.name,
            code: details.code,
            requestId: details.requestId,
        });
        res.status(502).json({ error: "Could not open Stripe setup. Try again or contact PasarPixel support." });
    }
}
