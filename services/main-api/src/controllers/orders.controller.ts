import { Request, Response } from "express";
import { Prisma, PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

const VALID_PAYMENT_STATUSES: PaymentStatus[] = [
    "PENDING",
    "COMPLETED",
    "FAILED",
    "REFUNDED",
];

// Mirrors asset.controller's helper so list pagination behaves the same way.
function parsePositiveInt(value: unknown, fallback: number, max?: number): number {
    const n = parseInt(String(value ?? ""), 10);
    if (isNaN(n) || n < 1) return fallback;
    if (max !== undefined && n > max) return max;
    return n;
}

// GET /orders — the authenticated buyer's purchase history.
// Defaults to COMPLETED orders; ?paymentStatus= can widen to other states.
// ?keyword= searches the titles of assets within each order.
export async function getMyOrders(req: Request, res: Response) {
    const userId = req.user!.userId;

    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, 20, 50);

    const where: Prisma.OrderWhereInput = { buyerId: userId };

    const statusParam = req.query.paymentStatus as string | undefined;
    if (statusParam && VALID_PAYMENT_STATUSES.includes(statusParam as PaymentStatus)) {
        where.paymentStatus = statusParam as PaymentStatus;
    } else {
        // "Purchase history" means what the buyer actually bought.
        where.paymentStatus = "COMPLETED";
    }

    const keyword = (req.query.keyword as string | undefined)?.trim();
    if (keyword) {
        where.orderItems = {
            some: {
                asset: { title: { contains: keyword, mode: "insensitive" } },
            },
        };
    }

    const [items, total] = await Promise.all([
        prisma.order.findMany({
            where,
            include: {
                orderItems: {
                    include: {
                        asset: {
                            include: {
                                files: true,
                                seller: {
                                    select: { userId: true, name: true, avatarUrl: true },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.order.count({ where }),
    ]);

    res.json({ items, total, page, pageSize });
}

// GET /orders/:id — detail for one of the buyer's own orders.
export async function getMyOrderById(req: Request, res: Response) {
    const userId = req.user!.userId;
    const orderId = parseInt(req.params.id as string);
    if (isNaN(orderId)) {
        res.status(400).json({ error: "Invalid order id" });
        return;
    }

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            orderItems: {
                include: {
                    asset: {
                        include: {
                            files: true,
                            seller: {
                                select: { userId: true, name: true, avatarUrl: true },
                            },
                        },
                    },
                },
            },
        },
    });

    // Don't reveal existence of other buyers' orders — treat as not found.
    if (!order || order.buyerId !== userId) {
        res.status(404).json({ error: "Order not found" });
        return;
    }

    res.json(order);
}
