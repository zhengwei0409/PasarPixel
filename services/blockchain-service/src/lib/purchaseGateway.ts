import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, type TransactionInstruction } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey } from "@metaplex-foundation/umi";
import { safeFetchAssetV1 } from "@metaplex-foundation/mpl-core";
import bs58 from "bs58";
import { lamportsToSol } from "../../../../shared/utils/solPrice";
import { DEVNET_GENESIS } from "./coreMint";
import { PURCHASE_PROGRAM_ID, CORE_PROGRAM_ID, decodeConfig, decodeListing, decodeReceipt, purchaseAddresses,
    initializeInstruction, listingInstruction, purchaseInstruction, hashBytes, type ListingState, type PurchaseRecord } from "./purchaseProtocol";

export interface PurchaseDraft { transaction: Uint8Array; lastValidBlockHeight: bigint }
export interface PurchaseSigned extends PurchaseDraft { signature: string; status?: "PENDING" | "CONFIRMED" | "FAILED" }
export interface PurchaseGateway {
    programId: string; sponsorAddress: string; treasuryAddress: string;
    addresses(master: string, buyer: string, tier: number): { listing: string; receipt: string };
    assetAddress(reference: string): string;
    syncListing(state: Omit<ListingState, "revision">): Promise<bigint>;
    build(record: PurchaseRecord): Promise<PurchaseDraft>;
    sign(record: PurchaseRecord, draft: Uint8Array, signed: Uint8Array): Promise<PurchaseSigned>;
    send(bytes: Uint8Array): Promise<void>;
    reconcile(record: PurchaseRecord, masterAddress: string, attempt: PurchaseSigned): Promise<"CONFIRMED" | "FAILED" | "PENDING">;
}
export class PurchaseBuildError extends Error {}

export function createPurchaseGateway(rpcUrl: string, secret: Uint8Array, program = PURCHASE_PROGRAM_ID, treasuryAddress?: string,
    maxCost = 30_000_000n): PurchaseGateway {
    const sponsor = Keypair.fromSecretKey(secret);
    const treasury = new PublicKey(treasuryAddress || sponsor.publicKey);
    const connection = new Connection(rpcUrl, { commitment: "confirmed", disableRetryOnRateLimit: true,
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) });
    const umi = createUmi(rpcUrl, { commitment: "finalized", disableRetryOnRateLimit: true,
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) });
    const assetKey = (reference: string) => Keypair.fromSeed(createHmac("sha256", secret).update(`pasarpixel:license:${reference}`).digest());
    const guard = async () => { if (await connection.getGenesisHash() !== DEVNET_GENESIS) throw new PurchaseBuildError("Purchases are restricted to Solana Devnet"); };
    const ownedAccount = async (key: PublicKey) => {
        const info = await connection.getAccountInfo(key, "finalized");
        if (info && !info.owner.equals(program)) throw new Error("Unexpected purchase account owner");
        return info;
    };
    async function simulate(tx: Transaction, record?: PurchaseRecord) {
        const before = await connection.getBalance(sponsor.publicKey, "confirmed");
        const response = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(15_000),
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "simulateTransaction", params: [tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64"),
                { encoding: "base64", sigVerify: false, commitment: "confirmed", accounts: { encoding: "base64", addresses: [sponsor.publicKey.toBase58()] } }] }) });
        const result = await response.json();
        if (!response.ok || result.error) throw new Error("Devnet simulation unavailable");
        const value = result.result?.value;
        if (value?.err) {
            const rentIndex = value.err.InsufficientFundsForRent?.account_index;
            const rentAccount = Number.isInteger(rentIndex) ? tx.compileMessage().accountKeys[rentIndex]?.toBase58() : undefined;
            console.warn("Devnet transaction simulation rejected", { error: value.err, account: rentAccount, logs: value.logs?.slice(-8) });
            if (rentAccount && rentAccount === record?.buyerAddress) throw new PurchaseBuildError("Your Devnet wallet must keep Solana's minimum balance after paying. Add a little more test SOL and try again.");
            if (rentAccount === record?.sellerAddress || rentAccount === treasury.toBase58()) throw new PurchaseBuildError("The receiving wallet's minimum balance changed. Please retry so the platform can refresh its sponsorship.");
            if (rentAccount === sponsor.publicKey.toBase58() || value.err === "InsufficientFundsForFee") throw new PurchaseBuildError("The platform's Devnet sponsor needs more test SOL. Please try again later.");
            throw new PurchaseBuildError("The purchase could not be simulated. Refresh checkout and try again. No payment was submitted.");
        }
        if (!value?.accounts?.[0]) throw new Error("Devnet simulation returned no account information");
        const fee = await connection.getFeeForMessage(tx.compileMessage(), "confirmed");
        if (fee.value === null) throw new Error("Unable to estimate purchase fees");
        // Commission may credit the sponsor. Add it back when estimating the
        // platform's gross cost so a large purchase cannot hide expensive rent.
        return BigInt(before) - BigInt(value.accounts[0].lamports) + BigInt(fee.value);
    }
    async function management(instruction: TransactionInstruction) {
        const block = await connection.getLatestBlockhash("finalized");
        const tx = new Transaction({ feePayer: sponsor.publicKey, ...block }).add(instruction);
        tx.sign(sponsor);
        const cost = await simulate(tx);
        if (cost < 0n || cost > maxCost) throw new PurchaseBuildError("Platform transaction exceeds the Devnet sponsorship limit");
        const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
        const confirmation = await connection.confirmTransaction({ signature, ...block }, "finalized");
        if (confirmation.value.err) throw new PurchaseBuildError("Platform listing registration failed");
    }
    async function config() {
        const address = PublicKey.findProgramAddressSync([Buffer.from("config")], program)[0];
        let account = await ownedAccount(address);
        if (!account) {
            const deployed = await connection.getAccountInfo(program, "finalized");
            if (!deployed?.executable || deployed.data.length < 36) throw new PurchaseBuildError("Purchase program is not deployed on Devnet");
            const programData = new PublicKey(deployed.data.subarray(4, 36));
            await management(initializeInstruction(program, sponsor.publicKey, treasury, programData));
            account = await ownedAccount(address);
        }
        if (!account) throw new Error("Purchase configuration not finalized");
        const state = decodeConfig(account.data);
        if (state.authority !== sponsor.publicKey.toBase58() || state.treasury !== treasury.toBase58()) throw new PurchaseBuildError("Purchase authority or treasury does not match the deployed configuration");
    }
    return {
        programId: program.toBase58(), sponsorAddress: sponsor.publicKey.toBase58(), treasuryAddress: treasury.toBase58(),
        addresses(master, buyer, tier) { const address = purchaseAddresses(program, master, buyer, tier); return { listing: address.listing.toBase58(), receipt: address.receipt.toBase58() }; },
        assetAddress: reference => assetKey(reference).publicKey.toBase58(),
        async syncListing(state) {
            await guard(); await config();
            const address = purchaseAddresses(program, state.master, sponsor.publicKey.toBase58(), 0).listing;
            const account = await ownedAccount(address);
            const current = account ? decodeListing(account.data) : null;
            if (current && current.master === state.master && current.seller === state.seller && current.manifestHash === state.manifestHash &&
                current.personal === state.personal && current.commercial === state.commercial && current.active === state.active) return current.revision;
            const revision = current ? current.revision + 1n : 1n;
            await management(listingInstruction(program, sponsor.publicKey, state.master, { ...state, revision }));
            return revision;
        },
        async build(record) {
            await guard();
            const asset = assetKey(record.id);
            if (asset.publicKey.toBase58() !== record.assetAddress) throw new PurchaseBuildError("Restore the original platform key before retrying this purchase");
            const buyer = new PublicKey(record.buyerAddress);
            const buyerInfo = await connection.getAccountInfo(buyer, "confirmed");
            const buyerBalance = BigInt(buyerInfo?.lamports ?? 0);
            if (buyerBalance < record.priceLamports) throw new PurchaseBuildError(`Your wallet has ${lamportsToSol(buyerBalance)} Devnet SOL, but this license costs ${lamportsToSol(record.priceLamports)} SOL. Add test SOL and try again.`);
            const buyerMinimum = BigInt(await connection.getMinimumBalanceForRentExemption(buyerInfo?.data.length ?? 0));
            const remaining = buyerBalance - record.priceLamports;
            if (remaining > 0n && remaining < buyerMinimum) throw new PurchaseBuildError(`Keep at least ${lamportsToSol(buyerMinimum)} SOL in your Devnet wallet after payment. Add a little more test SOL and try again.`);

            // A tiny first payout cannot create a below-rent wallet. Sponsor only
            // the shortfall, atomically with the purchase, never as a preparation
            // transfer that a cancelled checkout or background sync could repeat.
            const payouts = new Map<string, bigint>();
            payouts.set(record.sellerAddress, record.priceLamports - record.commissionLamports);
            if (record.commissionLamports > 0n) payouts.set(treasury.toBase58(), (payouts.get(treasury.toBase58()) ?? 0n) + record.commissionLamports);
            const topUps: TransactionInstruction[] = [];
            let totalTopUp = 0n;
            for (const [address, payout] of payouts) {
                if (address === sponsor.publicKey.toBase58()) continue;
                const recipient = new PublicKey(address);
                const info = await connection.getAccountInfo(recipient, "confirmed");
                const minimum = BigInt(await connection.getMinimumBalanceForRentExemption(info?.data.length ?? 0));
                const shortfall = minimum - BigInt(info?.lamports ?? 0) - payout;
                if (shortfall <= 0n) continue;
                totalTopUp += shortfall;
                if (totalTopUp > maxCost) throw new PurchaseBuildError("Purchase exceeds the platform sponsorship limit");
                topUps.push(SystemProgram.transfer({ fromPubkey: sponsor.publicKey, toPubkey: recipient, lamports: shortfall }));
            }
            const block = await connection.getLatestBlockhash("finalized");
            const tx = new Transaction({ feePayer: sponsor.publicKey, ...block }).add(...topUps, purchaseInstruction(program, sponsor.publicKey, treasury, record));
            tx.partialSign(asset); // Withhold the sponsor signature until the buyer returns the exact transaction.
            let cost = await simulate(tx, record);
            if (treasury.toBase58() === sponsor.publicKey.toBase58()) cost += record.commissionLamports;
            if (cost < 0n || cost > maxCost) throw new PurchaseBuildError("Purchase exceeds the platform sponsorship limit");
            return { transaction: tx.serialize({ requireAllSignatures: false }), lastValidBlockHeight: BigInt(block.lastValidBlockHeight) };
        },
        async sign(record, draft, bytes) {
            await guard();
            const expected = Transaction.from(draft);
            const submitted = Transaction.from(bytes);
            if (!expected.serializeMessage().equals(submitted.serializeMessage())) throw new PurchaseBuildError("The purchase transaction was modified");
            const buyer = new PublicKey(record.buyerAddress);
            const signature = submitted.signatures.find(item => item.publicKey.equals(buyer))?.signature;
            if (!signature) throw new PurchaseBuildError("The bound buyer wallet must sign the purchase");
            expected.addSignature(buyer, signature);
            if (!expected.verifySignatures(false)) throw new PurchaseBuildError("Buyer transaction signature is invalid");
            expected.partialSign(sponsor);
            const signed = expected.serialize();
            return { transaction: signed, signature: bs58.encode(expected.signature!), lastValidBlockHeight: 0n };
        },
        async send(bytes) { await guard(); await connection.sendRawTransaction(bytes, { skipPreflight: false, maxRetries: 3 }); },
        async reconcile(record, masterAddress, attempt) {
            await guard();
            const [status] = (await connection.getSignatureStatuses([attempt.signature], { searchTransactionHistory: true })).value;
            const account = await ownedAccount(new PublicKey(record.receiptAddress));
            if (account) {
                const receipt = decodeReceipt(account.data);
                if (receipt.master !== masterAddress || receipt.listing !== record.listingAddress || receipt.assetAddress !== record.assetAddress ||
                    receipt.buyer !== record.buyerAddress || receipt.seller !== record.sellerAddress || receipt.treasury !== treasury.toBase58() ||
                    receipt.tier !== (record.licenseType === "PERSONAL" ? 0 : 1) || receipt.purchaseRef !== hashBytes(record.id).toString("hex") ||
                    receipt.price !== record.priceLamports || receipt.commission !== record.commissionLamports || receipt.revision !== record.revision ||
                    receipt.manifestHash !== record.manifestHash || receipt.termsHash !== record.termsHash || receipt.metadataHash !== record.metadataHash) throw new Error("Purchase receipt does not match the authorized purchase");
                const asset = await safeFetchAssetV1(umi, publicKey(record.assetAddress), { commitment: "finalized" });
                if (!asset || asset.header.owner !== CORE_PROGRAM_ID.toBase58() || asset.owner !== record.buyerAddress || asset.uri !== record.metadataUri || asset.name !== record.name ||
                    asset.updateAuthority.type !== "None" || !asset.permanentFreezeDelegate?.frozen || asset.permanentFreezeDelegate.authority.type !== "None" ||
                    asset.permanentBurnDelegate || asset.permanentTransferDelegate) throw new Error("License NFT does not match the purchase receipt");
                // A previously finalized receipt remains proof after an RPC
                // provider prunes the transaction's signature history.
                return attempt.status === "CONFIRMED" || (status?.confirmationStatus === "finalized" && !status.err) ? "CONFIRMED" : "PENDING";
            }
            if (status?.confirmationStatus === "finalized" && status.err) return "FAILED";
            if (status) return "PENDING";
            return BigInt(await connection.getBlockHeight("finalized")) > attempt.lastValidBlockHeight ? "FAILED" : "PENDING";
        },
    };
}

export function configuredPurchaseGateway(): PurchaseGateway | undefined {
    if (process.env.PURCHASE_ENABLED !== "true") return;
    if (!process.env.INTERNAL_SERVICE_TOKEN || process.env.INTERNAL_SERVICE_TOKEN.length < 32) throw new Error("Configure INTERNAL_SERVICE_TOKEN before enabling purchases");
    const raw: unknown = JSON.parse(readFileSync(process.env.PLATFORM_WALLET_FILE || ".secrets/devnet-sponsor.json", "utf8"));
    if (!Array.isArray(raw) || raw.length !== 64 || !raw.every(n => Number.isInteger(n) && n >= 0 && n < 256)) throw new Error("Invalid Devnet sponsor key");
    return createPurchaseGateway(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", Uint8Array.from(raw),
        new PublicKey(process.env.PURCHASE_PROGRAM_ID || PURCHASE_PROGRAM_ID), process.env.PLATFORM_TREASURY_ADDRESS);
}
