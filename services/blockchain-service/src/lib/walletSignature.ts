import { createPublicKey, randomBytes, verify } from "node:crypto";
import bs58 from "bs58";
import { HttpError } from "./errors";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function parseWalletAddress(address: unknown): string {
    if (typeof address !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        throw new HttpError(400, "Enter a valid Solana wallet address");
    }
    try {
        const bytes = bs58.decode(address);
        if (bytes.length === 32 && bs58.encode(bytes) === address) return address;
    } catch { /* Invalid base58 input. */ }
    throw new HttpError(400, "Enter a valid Solana wallet address");
}

export function createChallengeMessage(origin: string, userId: number, address: string, now: Date) {
    const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
    // A readable, purpose-specific message, never a transaction or a login token.
    const message = [
        "PasarPixel wallet binding",
        "Approve linking this wallet to your signed-in PasarPixel account.",
        "This signature does not authorize a payment or transfer.",
        "",
        `Domain: ${new URL(origin).host}`,
        `URI: ${origin}/settings`,
        "Network: Solana Devnet",
        `Account: ${userId}`,
        `Wallet: ${address}`,
        `Nonce: ${randomBytes(32).toString("hex")}`,
        `Issued At: ${now.toISOString()}`,
        `Expiration Time: ${expiresAt.toISOString()}`,
    ].join("\n");
    return { message, expiresAt };
}

export function verifyWalletSignature(address: string, message: string, signature: unknown): boolean {
    // Ed25519 signatures are exactly 64 bytes, encoded here as canonical base64.
    if (typeof signature !== "string" || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) return false;
    try {
        const bytes = Buffer.from(signature, "base64");
        if (bytes.length !== 64 || bytes.toString("base64") !== signature) return false;
        const key = createPublicKey({
            key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), bs58.decode(address)]),
            format: "der",
            type: "spki",
        });
        return verify(null, Buffer.from(message, "utf8"), key, bytes);
    } catch {
        return false;
    }
}
