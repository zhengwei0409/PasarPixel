import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import {
    ADMIN_PAYMENT_METHODS, ADMIN_PAYMENT_STATUSES,
    type AdminTransactionsResponse,
} from "../../../../shared/types/adminTransaction";
import { prisma } from "../lib/prisma";

const PAGE_SIZE = 20;
const accountSelect = { userId: true, name: true, email: true } as const;
const orderBy = [{ createdAt: "desc" }, { id: "desc" }] as const;

function isOption<T extends string>(options: readonly T[], value: unknown): value is T {
    return typeof value === "string" && options.some((option) => option === value);
}

export async function listAdminTransactions(req: Request, res: Response) {
    const { kind = "purchase", status, method, search, page: pageParam = "1" } = req.query;
    const page = Number(pageParam);
    if (typeof pageParam !== "string" || !/^\d+$/.test(pageParam) || page < 1 || page > 1_000_000
        || kind !== "purchase"
        || (status !== undefined && !isOption(ADMIN_PAYMENT_STATUSES, status))
        || (method !== undefined && !isOption(ADMIN_PAYMENT_METHODS, method))
        || (search !== undefined && (typeof search !== "string" || search.length > 200))) {
        res.status(400).json({ error: "Invalid transaction filters" });
        return;
    }

    const term = typeof search === "string" ? search.trim() : "";
    const idMatch = term.match(/^(?:(?:order|user)\s+)?#?(\d+)$/i);
    const id = Number(idMatch?.[1]);
    const validId = Number.isInteger(id) && id > 0 && id <= 2_147_483_647;
    const text = { contains: term.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" } as const;
    const accountMatch = { OR: [{ name: text }, { email: text }, ...(validId ? [{ userId: id }] : [])] };
    const pagination = { orderBy: [...orderBy], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE };
    const where: Prisma.OrderWhereInput = {
        ...(isOption(ADMIN_PAYMENT_STATUSES, status) ? { paymentStatus: status } : {}),
        ...(isOption(ADMIN_PAYMENT_METHODS, method) ? { paymentMethod: method } : {}),
        ...(term ? { OR: [
            ...(validId ? [{ id }] : []), { buyer: accountMatch },
            { stripePaymentId: term }, { blockchainSignature: term }, { purchaseRef: term },
        ] } : {}),
    };
    const [orders, total] = await Promise.all([
        prisma.order.findMany({
            where, ...pagination,
            select: {
                id: true, buyer: { select: accountSelect }, paymentStatus: true, paymentMethod: true,
                totalAmount: true, currency: true, totalLamports: true, stripePaymentId: true,
                blockchainSignature: true, purchaseRef: true, createdAt: true, updatedAt: true,
                _count: { select: { orderItems: true } },
            },
        }),
        prisma.order.count({ where }),
    ]);
    const items = orders.map((order): AdminTransactionsResponse["items"][number] => ({
        id: order.id, kind: "purchase", account: order.buyer, status: order.paymentStatus, method: order.paymentMethod,
        currency: order.currency, amount: order.totalAmount.toString(), totalLamports: order.totalLamports,
        reference: order.paymentMethod === "STRIPE" ? order.stripePaymentId : order.blockchainSignature ?? order.purchaseRef,
        referenceLabel: order.paymentMethod === "STRIPE" ? "Stripe session ID" : order.blockchainSignature ? "Solana signature" : "Purchase reference",
        itemCount: order._count.orderItems, createdAt: order.createdAt.toISOString(), updatedAt: order.updatedAt.toISOString(),
    }));

    res.set("Cache-Control", "no-store").json({ items, total, page, pageSize: PAGE_SIZE } satisfies AdminTransactionsResponse);
}
