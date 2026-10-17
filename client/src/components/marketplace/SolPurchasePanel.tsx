import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import { Dialog, DialogTrigger } from "../ui/dialog";
import { useAuth } from "../../hooks/useAuth";
import apiClient from "../../lib/apiClient";
import { formatLamportsSol } from "../../lib/price";
import SolCheckoutDialog from "./SolCheckoutDialog";
import type { SolOffer, SolPurchaseResponse, SolTier } from "../../types/solPurchase";

export default function SolPurchasePanel({ assetId, sellerId, assetTitle }: { assetId: number; sellerId: number; assetTitle: string }) {
    const { user } = useAuth();
    const client = useQueryClient();
    const [tier, setTier] = useState<SolTier | null>(null);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [result, setResult] = useState<SolPurchaseResponse | null>(null);
    const canBuy = Boolean(user?.roles.includes("BUYER") && Number(user.sub) !== sellerId);
    const offer = useQuery({ queryKey: ["solOffer", user?.sub, assetId], enabled: canBuy,
        queryFn: async () => (await apiClient.get<SolOffer>(`/blockchain/offers/${assetId}`)).data, refetchInterval: 10_000 });
    const selectedTier = tier ?? (offer.data?.personal && offer.data.personal !== "0" ? "PERSONAL" : "COMMERCIAL");
    const price = (selectedTier === "PERSONAL" ? offer.data?.personal : offer.data?.commercial) || "0";
    const existing = offer.data?.purchases?.find(p => p.licenseType === selectedTier);
    const recent = result?.purchase.licenseType === selectedTier ? result.purchase : existing;
    const purchaseId = recent?.id;
    const status = useQuery({ queryKey: ["solPurchase", user?.sub, purchaseId], enabled: canBuy && Boolean(purchaseId),
        queryFn: async () => (await apiClient.get<SolPurchaseResponse>(`/blockchain/purchases/${purchaseId}`)).data,
        refetchInterval: query => { const p = query.state.data?.purchase; return !p || ["PREPARING", "AWAITING_SIGNATURE", "PENDING"].includes(p.status) || (p.status === "CONFIRMED" && !p.orderId) ? 2500 : false; } });
    const purchase = status.data?.purchase ?? recent;
    const pending = purchase?.status === "PENDING" || purchase?.status === "PREPARING" || (purchase?.status === "CONFIRMED" && !purchase.orderId);
    const completed = purchase?.status === "CONFIRMED" && Boolean(purchase.orderId);
    const onPurchase = (data: SolPurchaseResponse) => {
        client.setQueryData(["solPurchase", user?.sub, data.purchase.id], data);
        setResult(data);
    };
    if (!user) return <Button asChild className="h-12 w-full"><Link to="/login">Sign in to buy with SOL</Link></Button>;
    if (Number(user.sub) === sellerId) return <p className="rounded-xl border p-5 text-sm text-muted-foreground">This is your listing. You cannot buy your own asset.</p>;
    if (!canBuy) return <p className="text-sm text-muted-foreground">A buyer account is required for SOL purchases.</p>;
    return <div className="space-y-4 rounded-xl border p-5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Solana Devnet</p>
        {offer.isPending && !offer.data ? <p role="status">Loading SOL checkout…</p> : !offer.data ? <p role="alert">Unable to load SOL checkout. Please refresh.</p>
            : !offer.data.enabled && !checkoutOpen && !pending && !completed ? <p className="text-sm text-muted-foreground">{offer.data.reason || "This listing is currently unavailable."}</p> : <>
                <div role="group" aria-label="Choose a SOL license" className="grid grid-cols-2 gap-3">
                    {(["PERSONAL", "COMMERCIAL"] as const).map(option => {
                        const amount = (option === "PERSONAL" ? offer.data.personal : offer.data.commercial) || "0";
                        return <button key={option} type="button" aria-pressed={selectedTier === option} disabled={amount === "0" || pending || checkoutOpen}
                            onClick={() => { setTier(option); setResult(null); }}
                            className={`rounded-lg border-2 p-3 text-left disabled:opacity-40 ${selectedTier === option ? "border-primary bg-primary/5" : "border-border"}`}>
                            <span className="block text-sm font-medium">{option === "PERSONAL" ? "Personal" : "Commercial"}</span>
                            <span className="mt-2 block text-sm">{amount === "0" ? "Unavailable" : formatLamportsSol(amount)}</span>
                        </button>;
                    })}
                </div>
                {purchase?.status === "CONFIRMED" && purchase.orderId ? <>
                    <p role="status" className="text-sm">Purchase complete. Your License NFT is ready.</p>
                    <Button asChild className="w-full"><Link to={`/orders/${purchase.orderId}`}>View order and download</Link></Button>
                    <a href={purchase.explorerUrl} target="_blank" rel="noreferrer" className="text-sm underline">View License NFT</a>
                </> : <>
                    <p className="text-xs leading-5 text-muted-foreground">Pay in test SOL. Connect and verify your wallet during checkout.</p>
                    {purchase?.error && <p role="status" className="text-xs text-muted-foreground">{purchase.error}</p>}
                </>}
                <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
                    {!(purchase?.status === "CONFIRMED" && purchase.orderId) && <DialogTrigger asChild><Button className="h-11 w-full" disabled={price === "0" && !pending}>
                        {pending ? "View purchase status" : `Buy with ${formatLamportsSol(price)}`}
                    </Button></DialogTrigger>}
                    {checkoutOpen && <SolCheckoutDialog key={`${user.sub}:${assetId}`} userId={user.sub} assetId={assetId} assetTitle={assetTitle} tier={selectedTier} offer={offer.data} purchase={purchase} onPurchase={onPurchase} />}
                </Dialog>
                {pending && <p role="status" className="text-xs">Confirming your purchase. You can return here to check its status.</p>}
                {status.isError && <p role="alert" className="text-xs text-red-700">Unable to check purchase status. Please refresh.</p>}
            </>}
    </div>;
}
