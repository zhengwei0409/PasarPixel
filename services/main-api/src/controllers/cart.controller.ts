import { Request, Response } from "express";
import { LicenseType } from "@prisma/client";
import { prisma } from "../lib/prisma";

const MAX_CART_ITEMS = 50;

const VALID_LICENSE_TYPES: LicenseType[] = ["PERSONAL", "COMMERCIAL"];

function parseLicenseType(value: unknown): LicenseType | null {
    return VALID_LICENSE_TYPES.includes(value as LicenseType) ? (value as LicenseType) : null;
}

export async function getCart(req: Request, res: Response) {
    const userId = req.user!.userId;

    const items = await prisma.cartItem.findMany({
        where: { userId },
        include: {
            asset: {
                include: {
                    files: true,
                    seller: { select: { userId: true, name: true, avatarUrl: true } },
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    res.json({ items });
}

export async function addToCart(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { assetId, licenseType } = req.body;

    if (typeof assetId !== "number") {
        res.status(400).json({ error: "assetId (number) is required" });
        return;
    }

    const license = parseLicenseType(licenseType);
    if (!license) {
        res.status(400).json({ error: "licenseType must be PERSONAL or COMMERCIAL" });
        return;
    }

    const asset = await prisma.asset.findFirst({
        where: { id: assetId, status: "PUBLISHED", isDeleted: false },
        select: { id: true, listingType: true },
    });
    if (!asset) {
        res.status(404).json({ error: "Asset not found or not available" });
        return;
    }

    if (asset.listingType === "BLOCKCHAIN") {
        res.status(400).json({
            error: "Blockchain listings are purchased directly with SOL, not via cart",
        });
        return;
    }

    const existing = await prisma.cartItem.findUnique({
        where: { userId_assetId: { userId, assetId } },
    });
    if (existing) {
        res.status(409).json({ error: "Asset is already in your cart" });
        return;
    }

    const count = await prisma.cartItem.count({ where: { userId } });
    if (count >= MAX_CART_ITEMS) {
        res.status(422).json({ error: `Cart is full (max ${MAX_CART_ITEMS} items)` });
        return;
    }

    const item = await prisma.cartItem.create({
        data: { userId, assetId, licenseType: license },
    });

    res.status(201).json(item);
}

export async function updateCartItemLicense(req: Request, res: Response) {
    const userId = req.user!.userId;
    const cartItemId = parseInt(req.params.id as string);
    if (isNaN(cartItemId)) {
        res.status(400).json({ error: "Invalid cart item id" });
        return;
    }

    const license = parseLicenseType(req.body.licenseType);
    if (!license) {
        res.status(400).json({ error: "licenseType must be PERSONAL or COMMERCIAL" });
        return;
    }

    const existing = await prisma.cartItem.findUnique({ where: { id: cartItemId } });
    if (!existing || existing.userId !== userId) {
        res.status(404).json({ error: "Cart item not found" });
        return;
    }

    const updated = await prisma.cartItem.update({
        where: { id: cartItemId },
        data: { licenseType: license },
    });

    res.json(updated);
}

export async function removeFromCart(req: Request, res: Response) {
    const userId = req.user!.userId;
    const cartItemId = parseInt(req.params.id as string);
    if (isNaN(cartItemId)) {
        res.status(400).json({ error: "Invalid cart item id" });
        return;
    }

    const existing = await prisma.cartItem.findUnique({ where: { id: cartItemId } });
    if (!existing || existing.userId !== userId) {
        res.status(404).json({ error: "Cart item not found" });
        return;
    }

    await prisma.cartItem.delete({ where: { id: cartItemId } });

    res.status(204).send();
}
