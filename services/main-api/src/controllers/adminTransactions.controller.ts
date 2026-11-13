import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import {
    ADMIN_PAYMENT_METHODS, ADMIN_PAYMENT_STATUSES, ADMIN_WITHDRAWAL_STATUSES,
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
        || (kind !== "purchase" && kind !== "withdrawal")
        || (status !== undefined && !(kind === "purchase" ? isOption(ADMIN_PAYMENT_STATUSES, status) : isOption(ADMIN_WITHDRAWAL_STATUSES, status)))
        || (method !== undefined && (kind !== "purchase" || !isOption(ADMIN_PAYMENT_METHODS, method)))
        || (search !== undefined && (typeof search !== "string" || search.length > 200))) {
        res.status(400).json({ error: "Invalid transaction filters" });
        return;
    }

    const term = typeof search === "string" ? search.trim() : "";
    const idMatch = term.match(/^(?:(?:order|withdrawal|user)\s+)?#?(\d+)$/i);
    const id = Number(idMatch?.[1]);
    const validId = Number.isInteger(id) && id > 0 && id <= 2_147_483_647;
    const text = { contains: term.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" } as const;
    const accountMatch = { OR: [{ name: text }, { email: text }, ...(validId ? [{ userId: id }] : [])] };
    const pagination = { orderBy: [...orderBy], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE };
    let items: AdminTransactionsResponse["items"];
    let total: number;

    if (kind === "purchase") {
        const where: Prisma.OrderWhereInput = {
            ...(isOption(ADMIN_PAYMENT_STATUSES, status) ? { paymentStatus: status } : {}),
            ...(isOption(ADMIN_PAYMENT_METHODS, method) ? { paymentMethod: method } : {}),
            ...(term ? { OR: [
                ...(validId ? [{ id }] : []), { buyer: accountMatch },
                { stripePaymentId: term }, { blockchainSignature: term }, { purchaseRef: term },
            ] } : {}),
        };
        const [orders, count] = await Promise.all([
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
        items = orders.map((order) => ({
            id: order.id, kind: "purchase", account: order.buyer, status: order.paymentStatus, method: order.paymentMethod,
            currency: order.currency, amount: order.totalAmount.toString(), totalLamports: order.totalLamports,
            reference: order.paymentMethod === "STRIPE" ? order.stripePaymentId : order.blockchainSignature ?? order.purchaseRef,
            referenceLabel: order.paymentMethod === "STRIPE" ? "Stripe session ID" : order.blockchainSignature ? "Solana signature" : "Purchase reference",
            itemCount: order._count.orderItems, createdAt: order.createdAt.toISOString(), updatedAt: order.updatedAt.toISOString(),
        }));
        total = count;
    } else {
        const where: Prisma.WithdrawalRequestWhereInput = {
            ...(isOption(ADMIN_WITHDRAWAL_STATUSES, status) ? { status } : {}),
            ...(term ? { OR: [...(validId ? [{ id }] : []), { seller: accountMatch }] } : {}),
        };
        const [withdrawals, count] = await Promise.all([
            prisma.withdrawalRequest.findMany({
                where, ...pagination,
                select: { id: true, seller: { select: accountSelect }, amount: true, status: true, createdAt: true, updatedAt: true },
            }),
            prisma.withdrawalRequest.count({ where }),
        ]);
        items = withdrawals.map((withdrawal) => ({
            id: withdrawal.id, kind: "withdrawal", account: withdrawal.seller, status: withdrawal.status,
            currency: "USD", amount: withdrawal.amount.toString(),
            createdAt: withdrawal.createdAt.toISOString(), updatedAt: withdrawal.updatedAt.toISOString(),
        }));
        total = count;
    }

    res.set("Cache-Control", "no-store").json({ items, total, page, pageSize: PAGE_SIZE } satisfies AdminTransactionsResponse);
}
