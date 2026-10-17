import { bindPhantomWallet, connectPhantom, getConnectedAddress, type PhantomProvider } from "./phantom";
import { signSolPurchase } from "./solPurchase";
import type { SolPurchaseResponse, SolTier } from "../types/solPurchase";
import type { WalletChallenge, WalletStatus } from "../types/wallet";

export type CheckoutWalletState = "unlinked" | "disconnected" | "mismatch" | "ready";
export function checkoutWalletState(status: WalletStatus, connectedAddress: string | null): CheckoutWalletState {
    if (!status.wallet) return "unlinked";
    if (!connectedAddress) return "disconnected";
    return status.wallet.address === connectedAddress ? "ready" : "mismatch";
}

export function isWalletRejection(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const request = error as { code?: number | string; message?: string };
    return request.code === 4001 || request.code === "ACTION_REJECTED" || /user (rejected|denied|cancelled|canceled)|request (rejected|declined)/i.test(request.message ?? "");
}

export class CheckoutCancelled extends Error {}
export class CheckoutSubmissionUnknown extends Error {}

type WalletApi = {
    status(): Promise<WalletStatus>;
    challenge(address: string): Promise<WalletChallenge>;
    verify(id: string, signature: string, options: { onlyIfUnbound: boolean }): Promise<WalletStatus>;
};

export async function connectCheckoutWallet(provider: PhantomProvider, api: WalletApi, assertSession: () => void,
    origin: string, onStatus: (status: WalletStatus) => void, onStep: (step: "connecting" | "verifying") => void) {
    let step: "connecting" | "verifying" = "connecting";
    try {
        assertSession(); onStep(step);
        const { publicKey } = await connectPhantom(provider);
        assertSession();
        const latest = await api.status();
        assertSession();
        onStatus(latest);
        // An existing binding always wins. A mismatched connection is displayed
        // in checkout; it must never silently replace the account's wallet.
        if (latest.wallet) return latest;
        step = "verifying"; onStep(step);
        const linked = await bindPhantomWallet(provider, {
            challenge: async address => {
                const current = await api.status(); onStatus(current);
                if (current.wallet) throw new Error("A wallet was just linked to your account. Check the wallet shown below and continue.");
                return api.challenge(address);
            },
            verify: (id, signature) => api.verify(id, signature, { onlyIfUnbound: true }),
        }, assertSession, origin, publicKey.toString());
        onStatus(linked);
        return linked;
    } catch (error) {
        if (isWalletRejection(error)) throw new CheckoutCancelled(step === "connecting"
            ? "Connection cancelled. No payment was submitted."
            : "Verification cancelled. No payment was submitted.");
        throw error;
    }
}

type PaymentInput = { assetId: number; masterAddress: string; priceLamports: string; licenseType: SolTier; termsHash: string };
type PaymentApi = {
    status(): Promise<WalletStatus>;
    prepare(assetId: number, licenseType: SolTier, termsHash: string): Promise<SolPurchaseResponse>;
    submit(id: string, transaction: string): Promise<SolPurchaseResponse>;
};
export async function paySolCheckout(provider: PhantomProvider, input: PaymentInput, api: PaymentApi,
    assertSession: () => void, onPurchase: (purchase: SolPurchaseResponse) => void, onStatus: (status: WalletStatus) => void,
    onStep: (step: "preparing" | "signing" | "submitting") => void) {
    assertSession(); onStep("preparing");
    const wallet = await api.status(); assertSession(); onStatus(wallet);
    if (checkoutWalletState(wallet, getConnectedAddress()) !== "ready" || provider.publicKey?.toString() !== wallet.wallet?.address) {
        throw new Error("Connect the linked wallet shown below before paying.");
    }
    const prepared = await api.prepare(input.assetId, input.licenseType, input.termsHash);
    assertSession(); onPurchase(prepared);
    if (prepared.purchase.status !== "AWAITING_SIGNATURE") return prepared;
    onStep("signing");
    let transaction: string;
    try { transaction = await signSolPurchase(provider, prepared.purchase, input, assertSession); }
    catch (error) {
        if (isWalletRejection(error)) throw new CheckoutCancelled("Payment cancelled. No payment was submitted.");
        throw error;
    }
    onStep("submitting");
    try { return await api.submit(prepared.purchase.id, transaction); }
    catch {
        // A timeout after submission cannot be labelled a cancelled/unpaid purchase.
        throw new CheckoutSubmissionUnknown("We couldn't confirm the submission. Check purchase status before trying again; your purchase reference is saved.");
    }
}
