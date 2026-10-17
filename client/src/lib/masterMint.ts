import { getConnectedAddress, type PhantomProvider } from "./phantom";
import type { MasterMint } from "../types/masterMint";

export async function signMasterMint(provider: PhantomProvider, master: MasterMint, origin: string) {
    const approval = master.authorization;
    const assertWallet = () => {
        if (getConnectedAddress() !== master.ownerAddress || provider.publicKey?.toString() !== master.ownerAddress) {
            throw new Error("Connect the Phantom wallet bound to your account before minting.");
        }
    };
    assertWallet();
    if (!approval || !master.metadataUri || !Number.isFinite(Date.parse(approval.expiresAt)) || Date.parse(approval.expiresAt) <= Date.now() ||
        !approval.message.startsWith("PasarPixel Master NFT mint\n") ||
        !approval.message.includes(`\nDomain: ${new URL(origin).host}\n`) ||
        !approval.message.includes(`\nURI: ${origin}/seller/listings\n`) ||
        !approval.message.includes("\nNetwork: Solana Devnet\n") ||
        !approval.message.includes(`\nOwner: ${master.ownerAddress}\n`) ||
        !approval.message.includes(`\nAsset: ${master.assetAddress}\n`) ||
        !approval.message.includes(`\nMetadata: ${master.metadataUri}\n`) ||
        !approval.message.includes(`\nAuthorization: ${approval.id}\n`)) throw new Error("Mint approval does not match this wallet, site or NFT. Please try again.");
    const signed = await provider.signMessage(new TextEncoder().encode(approval.message), "utf8");
    assertWallet();
    if (signed.publicKey.toString() !== master.ownerAddress || signed.signature.length !== 64) throw new Error("The signing wallet changed. Please try again.");
    return { authorizationId: approval.id, signature: btoa(String.fromCharCode(...signed.signature)) };
}
