import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { prisma } from "../lib/prisma";
import { getObjectBuffer, extractKeyFromUrl, putNftOriginalSnapshot } from "../lib/s3";
import { buildManifest, publicObjectUrl, sha256 } from "../lib/nftSnapshot";
import { nftDownloadName } from "../lib/nftDownloadName";

async function publicObject(body: Buffer, contentType: string) {
    const hash = sha256(body);
    await prisma.nftPublicObject.upsert({ where: { hash }, create: { hash, body: Uint8Array.from(body), contentType }, update: {} });
    return hash;
}

export async function publicLogoUri() {
    const source = await readFile(join(process.cwd(), "assets/pasarpixel-logo.jpeg"));
    const bytes = await sharp(source, { limitInputPixels: 40_000_000 }).rotate()
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
    return publicObjectUrl(await publicObject(bytes, "image/png"));
}

export async function getNftContent(req: Request, res: Response) {
    const hash = String(req.params.hash);
    if (!/^[a-f0-9]{64}$/.test(hash)) { res.status(404).end(); return; }
    const object = await prisma.nftPublicObject.findUnique({ where: { hash } });
    if (!object) { res.status(404).end(); return; }
    res.set({ "Content-Type": object.contentType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
    res.send(Buffer.from(object.body));
}

export async function getMintEligibility(req: Request, res: Response) {
    const assetId = Number(req.params.id);
    if (!Number.isSafeInteger(assetId) || assetId <= 0) { res.status(400).json({ error: "Invalid asset id" }); return; }
    const asset = await prisma.asset.findFirst({ where: { id: assetId, status: "PUBLISHED", listingType: "BLOCKCHAIN", isDeleted: false, hiddenByRevoke: false }, select: { id: true, sellerId: true } });
    res.set("Cache-Control", "no-store");
    if (!asset) { res.status(404).json({ error: "Listing is not available for minting" }); return; }
    res.json(asset);
}

export async function getMintSnapshot(req: Request, res: Response) {
    const assetId = Number(req.params.id);
    if (!Number.isSafeInteger(assetId) || assetId <= 0) { res.status(400).json({ error: "Invalid asset id" }); return; }
    const asset = await prisma.asset.findUnique({ where: { id: assetId }, include: { files: true } });
    if (!asset || asset.sellerId !== req.user!.userId) { res.status(404).json({ error: "Listing not found" }); return; }
    if (asset.listingType !== "BLOCKCHAIN" || asset.status !== "PUBLISHED" || asset.isDeleted || asset.hiddenByRevoke) {
        res.status(409).json({ error: "Only approved, available blockchain listings can be minted" }); return;
    }
    let snapshot = await prisma.assetMintSnapshot.findUnique({ where: { assetId } });
    if (!snapshot) {
        const originals = asset.files.filter(file => file.purpose === "ORIGINAL");
        if (!originals.length) { res.status(409).json({ error: "Upload original files before minting" }); return; }
        const listingRef = randomUUID();
        const privateFiles = [];
        const manifestFiles = [];
        for (const file of originals) {
            const bytes = await getObjectBuffer(extractKeyFromUrl(file.fileUrl));
            if (bytes.length !== file.fileSize || bytes.length > 100 * 1024 * 1024) {
                res.status(409).json({ error: "An original file has changed. Upload and review a new listing." }); return;
            }
            const hash = sha256(bytes);
            const key = await putNftOriginalSnapshot(hash, bytes);
            const reference = sha256(`${listingRef}:${file.id}`);
            manifestFiles.push({ reference, size: bytes.length, hash });
            privateFiles.push({ reference, key, fileType: file.fileType, size: bytes.length, hash,
                name: nftDownloadName({ name: extractKeyFromUrl(file.fileUrl).split("/").pop(), fileType: file.fileType }, privateFiles.length) });
        }
        const manifestHash = await publicObject(Buffer.from(buildManifest(listingRef, manifestFiles)), "application/json");
        // Use the same brand artwork for every NFT, regardless of asset category.
        const previewSource = await readFile(join(process.cwd(), "assets/pasarpixel-logo.jpeg"));
        const preview = await sharp(previewSource, { limitInputPixels: 40_000_000 }).rotate()
            .resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
        const previewHash = await publicObject(preview, "image/png");
        try {
            snapshot = await prisma.assetMintSnapshot.create({ data: { assetId, listingRef, title: asset.title, manifestHash, previewHash, originals: privateFiles } });
        } catch (error) {
            if ((error as { code?: string }).code !== "P2002") throw error;
            snapshot = await prisma.assetMintSnapshot.findUniqueOrThrow({ where: { assetId } });
        }
    }
    // Recheck moderation after storage work; snapshots remain immutable even on takedown.
    const available = await prisma.asset.findFirst({ where: { id: assetId, sellerId: req.user!.userId, status: "PUBLISHED", isDeleted: false, hiddenByRevoke: false } });
    if (!available) { res.status(409).json({ error: "Listing is no longer available for minting" }); return; }
    res.json({ assetId, sellerId: asset.sellerId, listingRef: snapshot.listingRef, title: snapshot.title,
        manifestHash: snapshot.manifestHash, manifestUri: publicObjectUrl(snapshot.manifestHash), previewUri: publicObjectUrl(snapshot.previewHash) });
}
