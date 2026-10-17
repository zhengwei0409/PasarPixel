import { createHash } from "node:crypto";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

export const PURCHASE_PROGRAM_ID = new PublicKey("2HpUk2sbKNzheHtEYXxiDVF7hPCEE2bZrhzctYhCUdjJ");
export const CORE_PROGRAM_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
export const discriminator = (kind: string, name: string) => createHash("sha256").update(`${kind}:${name}`).digest().subarray(0, 8);
export const hashBytes = (text: string) => createHash("sha256").update(text).digest();
export const u64 = (n: bigint) => { const out = Buffer.alloc(8); out.writeBigUInt64LE(n); return out; };
const i64 = (n: bigint) => { const out = Buffer.alloc(8); out.writeBigInt64LE(n); return out; };
const string = (s: string) => { const body = Buffer.from(s); const size = Buffer.alloc(4); size.writeUInt32LE(body.length); return Buffer.concat([size, body]); };
const key = (pubkey: PublicKey, isWritable = false, isSigner = false) => ({ pubkey, isSigner, isWritable });

export function purchaseAddresses(program: PublicKey, master: string, buyer: string, tier: number) {
    const config = PublicKey.findProgramAddressSync([Buffer.from("config")], program)[0];
    const listing = PublicKey.findProgramAddressSync([Buffer.from("listing"), new PublicKey(master).toBuffer()], program)[0];
    const receipt = PublicKey.findProgramAddressSync([Buffer.from("receipt"), listing.toBuffer(), new PublicKey(buyer).toBuffer(), Buffer.from([tier])], program)[0];
    return { config, listing, receipt };
}

export interface ListingState { master: string; seller: string; manifestHash: string; personal: bigint; commercial: bigint; revision: bigint; active: boolean }
export interface PurchaseRecord {
    id: string; assetAddress: string; buyerAddress: string; sellerAddress: string; listingAddress: string; receiptAddress: string;
    priceLamports: bigint; commissionLamports: bigint; revision: bigint; licenseType: "PERSONAL" | "COMMERCIAL";
    name: string; metadataUri: string; metadataHash: string; manifestHash: string; termsHash: string; expiresAt: Date | null;
}
export interface ReceiptState {
    listing: string; master: string; assetAddress: string; buyer: string; seller: string; treasury: string;
    tier: number; purchaseRef: string; manifestHash: string; termsHash: string; metadataHash: string;
    price: bigint; commission: bigint; revision: bigint; purchasedAt: bigint;
}

function reader(data: Buffer, name: string) {
    if (!data.subarray(0, 8).equals(discriminator("account", name))) throw new Error("Unexpected program account type");
    let offset = 8;
    const bytes = (size: number) => { if (offset + size > data.length) throw new Error("Truncated program account"); const value = data.subarray(offset, offset + size); offset += size; return value; };
    return { key: () => new PublicKey(bytes(32)).toBase58(), hash: () => bytes(32).toString("hex"), byte: () => bytes(1)[0],
        uint: () => bytes(8).readBigUInt64LE(), int: () => bytes(8).readBigInt64LE() };
}
export function decodeListing(data: Buffer): ListingState {
    const r = reader(data, "Listing");
    return { master: r.key(), seller: r.key(), manifestHash: r.hash(), personal: r.uint(), commercial: r.uint(), revision: r.uint(), active: r.byte() === 1 };
}
export function decodeReceipt(data: Buffer): ReceiptState {
    const r = reader(data, "PurchaseReceipt");
    return { listing: r.key(), master: r.key(), assetAddress: r.key(), buyer: r.key(), seller: r.key(), treasury: r.key(), tier: r.byte(),
        purchaseRef: r.hash(), manifestHash: r.hash(), termsHash: r.hash(), metadataHash: r.hash(), price: r.uint(), commission: r.uint(), revision: r.uint(), purchasedAt: r.int() };
}
export function decodeConfig(data: Buffer) { const r = reader(data, "Config"); return { authority: r.key(), treasury: r.key() }; }

export function initializeInstruction(program: PublicKey, authority: PublicKey, treasury: PublicKey, programData: PublicKey) {
    const config = PublicKey.findProgramAddressSync([Buffer.from("config")], program)[0];
    return new TransactionInstruction({ programId: program, keys: [key(authority, true, true), key(config, true), key(program), key(programData), key(SystemProgram.programId)],
        data: Buffer.concat([discriminator("global", "initialize"), treasury.toBuffer()]) });
}
export function listingInstruction(program: PublicKey, authority: PublicKey, master: string, state: ListingState) {
    const { config, listing } = purchaseAddresses(program, master, authority.toBase58(), 0);
    return new TransactionInstruction({ programId: program, keys: [key(authority, true, true), key(config), key(new PublicKey(master)), key(listing, true), key(SystemProgram.programId)],
        data: Buffer.concat([discriminator("global", "set_listing"), new PublicKey(state.seller).toBuffer(), Buffer.from(state.manifestHash, "hex"),
            u64(state.personal), u64(state.commercial), u64(state.revision), Buffer.from([state.active ? 1 : 0])]) });
}
export function purchaseInstruction(program: PublicKey, authority: PublicKey, treasury: PublicKey, record: PurchaseRecord) {
    const config = PublicKey.findProgramAddressSync([Buffer.from("config")], program)[0];
    return new TransactionInstruction({ programId: program,
        keys: [key(authority, true, true), key(config), key(new PublicKey(record.buyerAddress), true, true), key(new PublicKey(record.listingAddress)),
            key(new PublicKey(record.sellerAddress), true), key(treasury, true), key(new PublicKey(record.receiptAddress), true),
            key(new PublicKey(record.assetAddress), true, true), key(CORE_PROGRAM_ID), key(SystemProgram.programId)],
        data: Buffer.concat([discriminator("global", "purchase"), Buffer.from([record.licenseType === "PERSONAL" ? 0 : 1]), u64(record.priceLamports),
            u64(record.revision), i64(BigInt(Math.floor(record.expiresAt!.getTime() / 1000))), hashBytes(record.id), Buffer.from(record.termsHash, "hex"),
            Buffer.from(record.metadataHash, "hex"), string(record.name), string(record.metadataUri)]) });
}
