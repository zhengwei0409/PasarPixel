import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { parseSolLamports } from "../../../../shared/utils/solPrice";
import { activeAccount, purchaseProof, validInternalToken } from "../lib/blockchain";
import { publicLogoUri } from "./nftSnapshot.controller";
import { publishOrderPaid, publishAssetSold } from "../lib/publisher";

export async function purchaseSource(req: Request, res: Response) {
    if (!validInternalToken(req.headers["x-internal-token"])) { res.status(401).end(); return; }
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) { res.status(400).end(); return; }
    res.set("Cache-Control", "no-store");
    const asset = await prisma.asset.findUnique({ where: { id } });
    const snapshot = await prisma.assetMintSnapshot.findUnique({ where: { assetId: id } });
    if (!asset || !snapshot) { res.json({ available: false }); return; }
    const available = asset.status === "PUBLISHED" && asset.listingType === "BLOCKCHAIN" && !asset.isDeleted
        && !asset.hiddenByRevoke && await activeAccount(asset.sellerId, "SELLER");
    res.json({ available, assetId: id, sellerId: asset.sellerId, title: snapshot.title, listingRef: snapshot.listingRef,
        manifestHash: snapshot.manifestHash, logoUri: await publicLogoUri(),
        personal: parseSolLamports(asset.priceSolPersonal?.toFixed(9))?.toString() ?? "0",
        commercial: parseSolLamports(asset.priceSolCommercial?.toFixed(9))?.toString() ?? "0" });
}

export async function fulfillBlockchainPurchase(req: Request, res: Response) {
    if (!validInternalToken(req.headers["x-internal-token"])) { res.status(401).end(); return; }
    const reference = String(req.params.reference);
    const proof = await purchaseProof(reference);
    if (proof.status !== "CONFIRMED" || proof.purchaseRef !== reference) { res.status(409).end(); return; }
    const snapshot = await prisma.assetMintSnapshot.findUnique({ where: { assetId: proof.assetId } });
    if (!snapshot || snapshot.manifestHash !== proof.manifestHash) { res.status(409).end(); return; }
    let order = await prisma.order.findUnique({ where: { purchaseRef: reference }, include: { orderItems: true } });
    let created = false;
    if (!order) {
        try {
            order = await prisma.order.create({ data: {
                buyerId: proof.buyerId, paymentMethod: "SOL", purchaseRef: reference, paymentStatus: "COMPLETED",
                totalAmount: 0, currency: "USD", totalLamports: proof.priceLamports, blockchainSignature: proof.txSignature,
                orderItems: { create: { assetId: proof.assetId, licenseType: proof.licenseType, price: 0,
                    blockchainPurchaseRef: reference, priceLamports: proof.priceLamports, commissionLamports: proof.commissionLamports,
                    licenseAssetAddress: proof.assetAddress, masterAssetAddress: proof.masterAssetAddress, receiptAddress: proof.receiptAddress,
                    metadataUri: proof.metadataUri, buyerWalletAddress: proof.buyerAddress, termsVersion: proof.termsVersion,
                    termsHash: proof.termsHash, termsUri: proof.termsUri, manifestHash: proof.manifestHash,
                    originalSnapshot: snapshot.originals as Prisma.InputJsonValue } },
            }, include: { orderItems: true } });
            created = true;
        } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
            order = await prisma.order.findUniqueOrThrow({ where: { purchaseRef: reference }, include: { orderItems: true } });
        }
    }
    if (created) {
        // The order is durable even if the notification broker is unavailable.
        await Promise.allSettled([
            publishOrderPaid({ buyerId: proof.buyerId, orderId: order.id, itemCount: 1 }),
            publishAssetSold({ sellerId: proof.sellerId, assetId: proof.assetId, assetTitle: snapshot.title, orderId: order.id }),
        ]);
    }
    res.json({ orderId: order.id, orderItemId: order.orderItems[0].id });
}
