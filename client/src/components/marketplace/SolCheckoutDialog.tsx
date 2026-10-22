import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, LoaderCircle, Wallet } from "lucide-react";
import { Button } from "../ui/button";
import { DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { useWallet } from "../../hooks/useWallet";
import apiClient from "../../lib/apiClient";
import { getPhantom } from "../../lib/phantom";
import { CheckoutCancelled, CheckoutSubmissionUnknown, checkoutWalletState, connectCheckoutWallet, paySolCheckout } from "../../lib/solCheckout";
import { getErrorMessage } from "../../lib/errors";
import { formatLamportsSol } from "../../lib/price";
import { createWalletChallenge, getWalletStatus, verifyWalletChallenge } from "../../services/walletService";
import type { SolOffer, SolPurchase, SolPurchaseResponse, SolTier } from "../../types/solPurchase";
import type { WalletStatus } from "../../types/wallet";

type Props = {
    userId: string; assetId: number; assetTitle: string; tier: SolTier; offer: SolOffer;
    purchase?: SolPurchase; onPurchase(result: SolPurchaseResponse): void;
};
type Feedback = { kind: "cancelled" | "error" | "unknown"; message: string };

export default function SolCheckoutDialog({ userId, assetId, assetTitle, tier, offer, purchase, onPurchase }: Props) {
    const client = useQueryClient();
    const wallet = useWallet();
    const [acceptedHash, setAcceptedHash] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [step, setStep] = useState<string>("");
    const [checking, setChecking] = useState(false);
    const agreement = offer.terms?.[tier];
    const price = (tier === "PERSONAL" ? offer.personal : offer.commercial) || "0";
    const state = wallet.status.data ? checkoutWalletState(wallet.status.data, wallet.connectedAddress) : null;
    const pending = purchase?.status === "PENDING" || purchase?.status === "PREPARING" || (purchase?.status === "CONFIRMED" && !purchase.orderId);
    const completed = purchase?.status === "CONFIRMED" && Boolean(purchase.orderId);
    const displayPrice = (pending || completed) && purchase ? purchase.priceLamports : price;
    const saveWallet = (status: WalletStatus) => client.setQueryData(["wallet", userId], status);
    const assertSession = () => {
        const token = localStorage.getItem("accessToken");
        let subject: unknown;
        try { subject = token ? JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub : null; } catch { subject = null; }
        if (String(subject) !== String(userId)) throw new Error("Your sign-in session changed. Close checkout and sign in again.");
    };
    const showError = (error: Error) => setFeedback({
        kind: error instanceof CheckoutCancelled ? "cancelled" : error instanceof CheckoutSubmissionUnknown ? "unknown" : "error",
        message: getErrorMessage(error, error.message || "Unable to continue. Please try again."),
    });
    const refresh = () => {
        void client.invalidateQueries({ queryKey: ["wallet", userId] });
        void client.invalidateQueries({ queryKey: ["solOffer", userId, assetId] });
        void client.invalidateQueries({ queryKey: ["solPurchase", userId] });
    };
    const connect = useMutation({
        mutationFn: async () => {
            setFeedback(null);
            const provider = getPhantom();
            if (!provider) throw new Error("Install Phantom, then reload this page to connect your wallet.");
            return connectCheckoutWallet(provider, { status: getWalletStatus, challenge: createWalletChallenge, verify: verifyWalletChallenge },
                assertSession, window.location.origin, saveWallet, setStep);
        },
        onError: showError,
        onSettled: refresh,
    });
    const pay = useMutation({
        mutationFn: async () => {
            setFeedback(null);
            if (!agreement || acceptedHash !== agreement.hash || !offer.masterAssetAddress) throw new Error("Read and accept the license terms before paying.");
            const provider = getPhantom();
            if (!provider) throw new Error("Install Phantom, then reload this page to pay.");
            return paySolCheckout(provider, { assetId, masterAddress: offer.masterAssetAddress, priceLamports: price, licenseType: tier, termsHash: agreement.hash }, {
                status: getWalletStatus,
                prepare: async (id, licenseType, termsHash) => (await apiClient.post<SolPurchaseResponse>(`/blockchain/purchases/prepare/${id}`, { licenseType, termsHash })).data,
                submit: async (id, transaction) => (await apiClient.post<SolPurchaseResponse>(`/blockchain/purchases/${id}/submit`, { transaction })).data,
            }, assertSession, onPurchase, saveWallet, setStep);
        },
        onSuccess: onPurchase,
        onError: showError,
        onSettled: refresh,
    });
    const busy = connect.isPending || pay.isPending || checking;
    const checkPurchase = async () => {
        if (!purchase) return;
        setChecking(true);
        try {
            assertSession();
            onPurchase((await apiClient.get<SolPurchaseResponse>(`/blockchain/purchases/${purchase.id}`)).data);
            setFeedback(null);
        } catch { setFeedback({ kind: "unknown", message: "Purchase status is still unavailable. Please check again before trying another payment." }); }
        finally { setChecking(false); }
    };
    return <DialogContent className="checkout-theme max-h-[90dvh] overflow-y-auto bg-background p-6 shadow-xl ring-border sm:max-w-md" showCloseButton={!busy}
        onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
        onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader>
            <DialogTitle className="pr-7 text-xl text-primary">{completed ? "Purchase complete" : "Complete your purchase"}</DialogTitle>
            <DialogDescription>Connect your wallet, verify it once, then approve your payment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 border-y py-4 text-sm">
            <p className="font-medium break-words">{assetTitle}</p>
            <div className="flex justify-between text-muted-foreground"><span>{tier === "PERSONAL" ? "Personal" : "Commercial"} license</span><span className="text-secondary-foreground">Solana Devnet</span></div>
            <div className="flex justify-between font-medium text-primary"><span>{completed ? "You paid" : "You pay"}</span><span>{formatLamportsSol(displayPrice)}</span></div>
            <p className="text-xs text-muted-foreground">Test SOL only. The platform pays network and NFT creation fees.</p>
        </div>
        {completed ? <div className="space-y-4">
            <p role="status" className="flex items-center gap-2 text-sm text-primary"><Check className="size-4" /> Your License NFT is ready.</p>
            <Button asChild className="w-full hover:bg-[#444f3a]"><Link to={`/orders/${purchase!.orderId}`}>View order and download</Link></Button>
            <a href={purchase!.explorerUrl} target="_blank" rel="noreferrer" className="block text-sm text-primary underline underline-offset-4 hover:text-secondary-foreground">View License NFT</a>
        </div> : pending ? <div role="status" className="space-y-2 py-3 text-sm">
            <p className="flex items-center gap-2 font-medium"><LoaderCircle className="size-4 animate-spin" /> Confirming purchase…</p>
            <p className="text-muted-foreground">Waiting for Devnet confirmation and your order. You can close this dialog; your purchase resumes when you return.</p>
        </div> : <>
            <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm font-medium text-primary"><Wallet className="size-4 text-secondary-foreground" /> {state === "ready" ? "Wallet verified" : "Your payment wallet"}</p>
                {wallet.status.isPending ? <p role="status" className="text-sm text-muted-foreground">Checking your linked wallet…</p>
                    : wallet.status.isError ? <div className="space-y-2"><p role="alert" className="text-sm text-red-700">Unable to load your linked wallet.</p><Button variant="outline" onClick={() => void wallet.status.refetch()}>Try again</Button></div>
                    : <>
                        {wallet.status.data?.wallet && <div className="space-y-1"><p className="text-xs text-muted-foreground">Linked to your PasarPixel account</p><p className="break-all rounded-lg bg-muted p-3 font-mono text-xs">{wallet.status.data.wallet.address}</p></div>}
                        {state === "unlinked" && <div className="space-y-2 text-xs leading-5 text-muted-foreground">
                            <p>First purchase? Verify your wallet with a message signature. This step does not request payment.</p>
                            {wallet.connectedAddress && <p className="break-all font-mono text-primary">{wallet.connectedAddress}</p>}
                            <p>Your License NFT will be sent to this wallet. Once you own an NFT, this account's linked wallet cannot be replaced.</p>
                        </div>}
                        {state === "disconnected" && <p className="text-xs text-muted-foreground">Connect the linked wallet above to continue. You won't need to verify it again.</p>}
                        {state === "mismatch" && <div role="status" className="space-y-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                            <p className="font-medium">Switch account in Phantom</p>
                            <p>Currently connected:</p><p className="break-all font-mono">{wallet.connectedAddress}</p>
                            <p>Open Phantom and select the linked wallet shown above. Checkout will update when you switch. Your saved wallet stays the same.</p>
                        </div>}
                        {state !== "ready" && <Button variant="outline" className="w-full border-ring/40 bg-card text-primary hover:border-ring hover:bg-accent hover:text-primary" disabled={busy} onClick={() => connect.mutate()}>
                            {connect.isPending ? step === "verifying" ? "Verify in Phantom…" : "Connecting to Phantom…"
                                : feedback?.kind === "cancelled" ? "Try again" : state === "unlinked" ? "Connect & verify Phantom" : state === "mismatch" ? "Check wallet again" : "Connect Phantom"}
                        </Button>}
                        {!getPhantom() && <p className="text-xs text-muted-foreground"><a className="underline" href="https://phantom.com/" target="_blank" rel="noreferrer">Get Phantom</a>, then reload this page.</p>}
                    </>}
            </div>
            {agreement && <details className="text-xs leading-5"><summary className="cursor-pointer rounded-sm font-medium text-primary outline-none hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring">Read {agreement.title}</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-secondary-foreground">{agreement.clauses.map(clause => <li key={clause}>{clause}</li>)}</ol></details>}
            {!offer.enabled && <p role="status" className="text-xs text-muted-foreground">This listing is currently unavailable for new purchases. Your checkout selection is saved.</p>}
            <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" className="mt-1 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" disabled={busy} checked={Boolean(agreement && acceptedHash === agreement.hash)} onChange={event => setAcceptedHash(event.target.checked ? agreement?.hash ?? null : null)} />
                I accept the selected license terms. My License NFT cannot be transferred or burned.</label>
            {feedback?.kind === "unknown" ? <Button className="w-full hover:bg-[#444f3a]" disabled={busy} onClick={() => void checkPurchase()}>{checking ? "Checking purchase…" : "Check purchase status"}</Button>
                : <Button className="h-11 w-full hover:bg-[#444f3a] disabled:bg-accent disabled:text-secondary-foreground disabled:opacity-100" disabled={busy || wallet.status.isError || state !== "ready" || !offer.enabled || price === "0" || !agreement || acceptedHash !== agreement.hash} onClick={() => pay.mutate()}>
                    {pay.isPending ? step === "submitting" ? "Submitting payment…" : step === "signing" ? "Approve payment in Phantom…" : "Preparing payment…" : `Pay ${formatLamportsSol(price)}`}
                </Button>}
            {state === "ready" && !busy && <p className="text-xs text-muted-foreground">Wallet setup is complete. Payment is requested only when you click Pay.</p>}
        </>}
        {feedback && !pending && !completed && <p role={feedback.kind === "error" ? "alert" : "status"} className={`text-xs leading-5 ${feedback.kind === "error" ? "text-red-700" : "text-muted-foreground"}`}>{feedback.message}</p>}
        <DialogClose asChild><Button variant="ghost" className="text-secondary-foreground hover:bg-accent hover:text-primary" disabled={busy}>{pending || completed ? "Close" : "Continue browsing"}</Button></DialogClose>
    </DialogContent>;
}
