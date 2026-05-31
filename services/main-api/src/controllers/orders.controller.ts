import { Request, Response } from "express";
import { Prisma, PaymentStatus } from "@prisma/client";
import archiver from "archiver";
import { prisma } from "../lib/prisma";
import { getObjectStream, extractKeyFromUrl } from "../lib/s3";
import {
    signDownloadToken,
    verifyDownloadToken,
} from "../lib/downloadToken";

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

// GET /orders/:id/download-url — issue a short-lived signed download link (FR-3.4).
// Requires JWT (authenticate). Returns a URL whose token carries {orderId, userId, exp};
// the browser then hits /orders/:id/download?token=... without an auth header.
// Re-callable any time for unlimited re-downloads.
export async function getDownloadUrl(req: Request, res: Response) {
    const userId = req.user!.userId;
    const orderId = parseInt(req.params.id as string);
    if (isNaN(orderId)) {
        res.status(400).json({ error: "Invalid order id" });
        return;
    }

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, buyerId: true, paymentStatus: true },
    });

    // Don't reveal existence of other buyers' orders — treat as not found.
    if (!order || order.buyerId !== userId) {
        res.status(404).json({ error: "Order not found" });
        return;
    }

    // Only paid orders are downloadable.
    if (order.paymentStatus !== "COMPLETED") {
        res.status(403).json({ error: "Order is not paid" });
        return;
    }

    const token = signDownloadToken({ orderId, userId });
    res.json({ url: `/orders/${orderId}/download?token=${token}` });
}

// GET /orders/:id/download?token=... — stream the order's assets as a ZIP (FR-3.4).
// No JWT: authorisation comes from the signed token (browsers can't send headers on
// a plain download link). Token is verified, then re-checked against the DB.
export async function downloadOrderZip(req: Request, res: Response) {
    const orderId = parseInt(req.params.id as string);
    if (isNaN(orderId)) {
        res.status(400).json({ error: "Invalid order id" });
        return;
    }

    const token = req.query.token as string | undefined;
    if (!token) {
        res.status(401).json({ error: "Missing download token" });
        return;
    }

    const payload = verifyDownloadToken(token);
    if (!payload || payload.orderId !== orderId) {
        res.status(401).json({ error: "Invalid or expired download token" });
        return;
    }

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            orderItems: { include: { asset: { include: { files: true } } } },
        },
    });

    // Re-verify ownership and payment against the DB, not just the token.
    if (
        !order ||
        order.buyerId !== payload.userId ||
        order.paymentStatus !== "COMPLETED"
    ) {
        res.status(404).json({ error: "Order not found" });
        return;
    }

    // Collect every file across every purchased asset, namespaced by asset title
    // so files from different assets don't collide inside the ZIP.
    const entries: { key: string; name: string }[] = [];
    for (const item of order.orderItems) {
        const folder = `${item.asset.id}-${item.asset.title}`.replace(
            /[/\\]/g,
            "_"
        );
        for (const file of item.asset.files) {
            const key = extractKeyFromUrl(file.fileUrl);
            const filename = key.split("/").pop() || `file-${file.id}`;
            entries.push({ key, name: `${folder}/${filename}` });
        }
    }

    if (entries.length === 0) {
        res.status(404).json({ error: "No files to download" });
        return;
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="order-${orderId}.zip"`
    );

    const archive = archiver("zip", { zlib: { level: 9 } });

    // If archiving fails after headers are sent we can't change the status code;
    // destroy the connection so the client sees a broken (incomplete) download.
    archive.on("error", (err) => {
        console.error(`ZIP error for order ${orderId}:`, err);
        res.destroy(err);
    });

    archive.pipe(res);

    for (const entry of entries) {
        const stream = await getObjectStream(entry.key);
        archive.append(stream, { name: entry.name });
    }

    await archive.finalize();
}
