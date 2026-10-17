import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createSignerFromKeypair, keypairIdentity, publicKey } from "@metaplex-foundation/umi";
import { create, mplCore, safeFetchAssetV1, MPL_CORE_PROGRAM_ID, updateV1 } from "@metaplex-foundation/mpl-core";
import bs58 from "bs58";

export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export interface MintRecord { assetAddress: string; ownerAddress: string; name: string; metadataUri: string }
export interface SignedMint { signature: string; transaction: Uint8Array; lastValidBlockHeight: bigint }
export interface MintGateway {
    assetAddress(reference: string): string;
    build(master: MintRecord, reference: string): Promise<SignedMint>;
    send(transaction: Uint8Array): Promise<void>;
    reconcile(master: MintRecord, attempt: SignedMint): Promise<"READY" | "FAILED" | "PENDING">;
}
export class MintBuildError extends Error {}

export function createCoreGateway(rpcUrl: string, secret: Uint8Array, maxCost = 30_000_000n): MintGateway {
    const umi = createUmi(rpcUrl, { commitment: "confirmed", disableRetryOnRateLimit: true,
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) }).use(mplCore());
    const keypair = umi.eddsa.createKeypairFromSecretKey(secret);
    umi.use(keypairIdentity(keypair));
    const signer = (reference: string) => createSignerFromKeypair(umi, umi.eddsa.createKeypairFromSeed(
        createHmac("sha256", secret).update(`pasarpixel:master:${reference}`).digest()));
    const assertDevnet = async () => {
        if (await umi.rpc.getGenesisHash() !== DEVNET_GENESIS) throw new MintBuildError("Minting is restricted to Solana Devnet");
    };
    async function rpc(method: string, params: unknown[]) {
        const response = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(10_000) });
        const result = await response.json();
        if (!response.ok || result.error) throw new Error("Devnet RPC unavailable");
        return result.result;
    }
    return {
        assetAddress: reference => signer(reference).publicKey,
        async build(master, reference) {
            await assertDevnet();
            const asset = signer(reference);
            if (asset.publicKey !== master.assetAddress) throw new MintBuildError("Platform mint key changed; restore the original Devnet key to retry");
            const blockhash = await umi.rpc.getLatestBlockhash({ commitment: "finalized" });
            // ImmutableMetadata rejects every Update instruction, including
            // authority removal. None locks metadata and authority-managed plugins.
            const transaction = await create(umi, { asset, owner: publicKey(master.ownerAddress), name: master.name, uri: master.metadataUri,
                plugins: [{ type: "PermanentFreezeDelegate", frozen: true, authority: { type: "None" } }],
            }).add(updateV1(umi, { asset: asset.publicKey, newUpdateAuthority: { __kind: "None" } }))
                .setBlockhash(blockhash).buildAndSign(umi);
            const serialized = umi.transactions.serialize(transaction);
            const before = (await umi.rpc.getBalance(umi.payer.publicKey)).basisPoints;
            const simulation = await rpc("simulateTransaction", [Buffer.from(serialized).toString("base64"), {
                encoding: "base64", sigVerify: true, commitment: "confirmed", accounts: { encoding: "base64", addresses: [umi.payer.publicKey] },
            }]);
            if (simulation.value?.err || !simulation.value?.accounts?.[0]) throw new MintBuildError("Mint simulation failed. Check the Devnet sponsor balance and transaction configuration.");
            const fee = await rpc("getFeeForMessage", [Buffer.from(transaction.serializedMessage).toString("base64"), { commitment: "confirmed" }]);
            if (fee.value === null) throw new Error("Unable to estimate mint fee");
            const cost = before - BigInt(simulation.value.accounts[0].lamports) + BigInt(fee.value);
            if (cost < 0n || cost > maxCost) throw new MintBuildError("Mint exceeds the platform sponsorship limit");
            return { transaction: serialized, signature: bs58.encode(transaction.signatures[0]), lastValidBlockHeight: BigInt(blockhash.lastValidBlockHeight) };
        },
        async send(bytes) {
            await assertDevnet();
            await umi.rpc.sendTransaction(umi.transactions.deserialize(bytes), { skipPreflight: false, maxRetries: 3 });
        },
        async reconcile(master, attempt) {
            await assertDevnet();
            const [status] = await umi.rpc.getSignatureStatuses([bs58.decode(attempt.signature)], { searchTransactionHistory: true });
            const asset = await safeFetchAssetV1(umi, publicKey(master.assetAddress), { commitment: "finalized" });
            if (asset) {
                if (asset.header.owner !== MPL_CORE_PROGRAM_ID || asset.owner !== master.ownerAddress || asset.uri !== master.metadataUri || asset.name !== master.name ||
                    asset.updateAuthority.type !== "None" || !asset.permanentFreezeDelegate?.frozen || asset.permanentFreezeDelegate.authority.type !== "None" ||
                    asset.permanentTransferDelegate || asset.permanentBurnDelegate) throw new Error("On-chain Master NFT does not match its immutable snapshot");
                // The known backend-signed transaction must also finalize successfully.
                return status?.commitment === "finalized" && !status.error ? "READY" : "PENDING";
            }
            if (status?.commitment === "finalized" && status.error) return "FAILED";
            if (status) return "PENDING";
            const height = await rpc("getBlockHeight", [{ commitment: "finalized" }]);
            return BigInt(height) > attempt.lastValidBlockHeight ? "FAILED" : "PENDING";
        },
    };
}

export function configuredCoreGateway(): MintGateway | undefined {
    if (process.env.MINT_ENABLED !== "true") return undefined;
    const raw: unknown = JSON.parse(readFileSync(process.env.PLATFORM_WALLET_FILE || ".secrets/devnet-sponsor.json", "utf8"));
    if (!Array.isArray(raw) || raw.length !== 64 || !raw.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
        throw new Error("PLATFORM_WALLET_FILE must contain a dedicated 64-byte Devnet keypair");
    }
    const maxCost = BigInt(process.env.MAX_MINT_COST_LAMPORTS || "30000000");
    if (maxCost <= 0n || maxCost > 30_000_000n) throw new Error("MAX_MINT_COST_LAMPORTS must be between 1 and 30000000");
    return createCoreGateway(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", Uint8Array.from(raw), maxCost);
}
