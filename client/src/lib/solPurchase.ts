import { Buffer } from "buffer";
import { PublicKey, SystemInstruction, SystemProgram, Transaction } from "@solana/web3.js";
import type { SolPurchase, SolTier } from "../types/solPurchase";
import { getConnectedAddress, type PhantomProvider } from "./phantom";

const PROGRAM = new PublicKey("2HpUk2sbKNzheHtEYXxiDVF7hPCEE2bZrhzctYhCUdjJ");
const CORE = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";
// sha256("global:purchase")[0..8], matching the Anchor instruction discriminator.
const PURCHASE_DISCRIMINATOR = [21, 93, 113, 154, 193, 160, 242, 168];

export async function signSolPurchase(provider: PhantomProvider, quote: SolPurchase,
    expected: { masterAddress: string; priceLamports: string; licenseType: SolTier; termsHash: string }, assertSession: () => void) {
    const assertWallet = () => {
        assertSession();
        if (!provider.isConnected || getConnectedAddress() !== quote.buyerAddress || provider.publicKey?.toString() !== quote.buyerAddress) {
            throw new Error("Connect the Phantom wallet bound to your account before paying.");
        }
    };
    assertWallet();
    if (!provider.signTransaction || !quote.transaction || quote.programId !== PROGRAM.toBase58() || quote.status !== "AWAITING_SIGNATURE" ||
        quote.priceLamports !== expected.priceLamports || quote.licenseType !== expected.licenseType || quote.termsHash !== expected.termsHash ||
        !quote.expiresAt || !Number.isFinite(Date.parse(quote.expiresAt)) || Date.parse(quote.expiresAt) <= Date.now()) throw new Error("Purchase quote changed or expired. Please refresh and try again.");
    const transaction = Transaction.from(Buffer.from(quote.transaction, "base64"));
    const tier = quote.licenseType === "PERSONAL" ? 0 : 1;
    const listing = PublicKey.findProgramAddressSync([Buffer.from("listing"), new PublicKey(expected.masterAddress).toBuffer()], PROGRAM)[0];
    const receipt = PublicKey.findProgramAddressSync([Buffer.from("receipt"), listing.toBuffer(), new PublicKey(quote.buyerAddress).toBuffer(), Buffer.from([tier])], PROGRAM)[0];
    const config = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM)[0];
    const accounts = [quote.sponsorAddress, config.toBase58(), quote.buyerAddress, listing.toBase58(), quote.sellerAddress, quote.treasuryAddress,
        receipt.toBase58(), quote.assetAddress, CORE, SystemProgram.programId.toBase58()];
    const ix = transaction.instructions.at(-1);
    const recipients = new Set<string>();
    let sponsoredLamports = 0n;
    const sponsoredTransfersValid = transaction.instructions.length <= 3 && transaction.instructions.slice(0, -1).every(instruction => {
        try {
            if (!instruction.programId.equals(SystemProgram.programId) || instruction.keys.length !== 2 || instruction.data.length !== 12) return false;
            const transfer = SystemInstruction.decodeTransfer(instruction);
            const recipient = transfer.toPubkey.toBase58();
            const amount = BigInt(transfer.lamports);
            if (transfer.fromPubkey.toBase58() !== quote.sponsorAddress || ![quote.sellerAddress, quote.treasuryAddress].includes(recipient) ||
                recipient === quote.buyerAddress || recipient === quote.sponsorAddress || recipients.has(recipient) || amount <= 0n) return false;
            recipients.add(recipient); sponsoredLamports += amount;
            return sponsoredLamports <= 30_000_000n;
        } catch { return false; }
    });
    if (!sponsoredTransfersValid || !ix || !ix.programId.equals(PROGRAM) || transaction.feePayer?.toBase58() !== quote.sponsorAddress ||
        quote.listingAddress !== listing.toBase58() || quote.receiptAddress !== receipt.toBase58() || ix.keys.length !== accounts.length ||
        ix.keys.some((account, index) => account.pubkey.toBase58() !== accounts[index]) || ix.data.length < 137 ||
        !PURCHASE_DISCRIMINATOR.every((byte, index) => ix.data[index] === byte) || ix.data[8] !== tier ||
        ix.data.readBigUInt64LE(9).toString() !== quote.priceLamports || ix.data.readBigUInt64LE(17).toString() !== quote.revision ||
        ix.data.readBigInt64LE(25) !== BigInt(Math.floor(Date.parse(quote.expiresAt) / 1000)) ||
        Buffer.from(ix.data.subarray(65, 97)).toString("hex") !== quote.termsHash || Buffer.from(ix.data.subarray(97, 129)).toString("hex") !== quote.metadataHash) {
        throw new Error("Transaction does not match the selected license, price or recipients.");
    }
    const message = transaction.serializeMessage();
    const signed = await provider.signTransaction(transaction);
    assertWallet();
    if (!message.equals(signed.serializeMessage())) throw new Error("The transaction changed while signing.");
    return signed.serialize({ requireAllSignatures: false }).toString("base64");
}
