import { createHash, randomBytes, randomUUID } from "node:crypto";

export interface MintSource {
    assetId: number; sellerId: number; listingRef: string; title: string;
    manifestHash: string; manifestUri: string; previewUri: string;
}
export const contentHash = (body: string) => createHash("sha256").update(body).digest("hex");

export function masterMetadata(source: MintSource, ownerAddress: string) {
    const name = Array.from(source.title).slice(0, 32).join("");
    const body = JSON.stringify({
        name, symbol: "PASAR", description: "PasarPixel seller Master NFT. Individual usage licenses are issued separately.",
        image: source.previewUri, schemaVersion: 1, listingRef: source.listingRef,
        sellerWallet: ownerAddress, contentManifestUri: source.manifestUri, contentManifestHash: source.manifestHash,
        attributes: [{ trait_type: "NFT type", value: "Master" }, { trait_type: "Network", value: "Solana Devnet" }],
        properties: { category: "image", files: [{ uri: source.previewUri, type: "image/png" }] },
    });
    return { name, body, hash: contentHash(body) };
}

export function mintAuthorization(origin: string, assetAddress: string, ownerAddress: string, metadataUri: string, now = new Date()) {
    const authorizationId = randomUUID();
    const expiresAt = new Date(now.getTime() + 5 * 60_000);
    const message = ["PasarPixel Master NFT mint", "Approve creating one non-transferable Master NFT in your bound wallet.",
        "The platform pays Devnet fees. This does not authorize a payment from your wallet.", "",
        `Domain: ${new URL(origin).host}`, `URI: ${origin}/seller/listings`, "Network: Solana Devnet",
        `Owner: ${ownerAddress}`, `Asset: ${assetAddress}`, `Metadata: ${metadataUri}`,
        `Authorization: ${authorizationId}`, `Nonce: ${randomBytes(32).toString("hex")}`,
        `Expiration Time: ${expiresAt.toISOString()}`].join("\n");
    return { authorizationId, message, expiresAt };
}
