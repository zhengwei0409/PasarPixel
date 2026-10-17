import { createHash } from "node:crypto";

export const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

// Only explicitly selected public fields are serialized. No storage keys,
// original filenames, internal IDs, signed URLs or buyer/seller personal data.
export function buildManifest(listingRef: string, files: { reference: string; size: number; hash: string }[]) {
    return JSON.stringify({ schemaVersion: 1, listingRef, files: [...files].sort((a, b) => a.reference.localeCompare(b.reference))
        .map(({ reference, size, hash }) => ({ reference, size, hash })) });
}

export function publicObjectUrl(hash: string) {
    const origin = process.env.PUBLIC_API_URL || (process.env.NODE_ENV === "production"
        ? `${process.env.CLIENT_URL}/api` : "http://localhost:8000");
    const url = new URL(origin);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error("Invalid PUBLIC_API_URL");
    }
    return `${origin.replace(/\/$/, "")}/assets/nft-content/${hash}`;
}
