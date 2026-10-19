import { Check, ChevronDown, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { getErrorMessage } from "@/lib/errors";

export default function WalletSection() {
    const { status, connect, bind, disconnect, connectedAddress } = useWallet();
    const wallet = status.data?.wallet;
    const matches = Boolean(wallet && wallet.address === connectedAddress);
    const mismatch = Boolean(wallet && connectedAddress && !matches);
    const busy = connect.isPending || bind.isPending || disconnect.isPending;
    const connectionLabel = matches ? "Linked wallet connected" : mismatch ? "Phantom connected · Different wallet selected" : wallet ? "Linked wallet not connected"
        : connectedAddress ? "Wallet detected · Not linked" : "Phantom not connected";
    return (
        <section aria-labelledby="wallet-heading" className="rounded-xl border border-[#e7e9e1] bg-white p-6 shadow-[0_2px_4px_-3px_rgba(37,40,35,0.15)] sm:p-9">
            <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e9ecdf] text-[#657152]">
                    <Wallet className="size-5" aria-hidden="true" />
                </div>
                <div>
                    <p className="mb-2 text-[10px] font-medium tracking-[0.18em] text-[#73776e] uppercase">Solana Devnet</p>
                    <h2 id="wallet-heading" className="text-xl font-semibold tracking-[-0.03em]">Phantom wallet</h2>
                    <p className="mt-2 text-sm leading-6 text-[#73776e]">{wallet ? "Manage your linked wallet and its connection to Phantom." : "Connect Phantom, then verify ownership to link a wallet to your account. No payment is requested."}</p>
                </div>
            </div>
            <div className="mt-8 space-y-4 border-t border-[#e7e9e1] pt-6">
                {status.isPending ? <p role="status" className="text-sm text-[#73776e]">Loading your wallet…</p> : status.isError ? (
                    <div role="alert" className="space-y-3">
                        <p className="text-sm text-red-700">{getErrorMessage(status.error, "Unable to load your wallet.")}</p>
                        <Button variant="outline" onClick={() => void status.refetch()}>Try again</Button>
                    </div>
                ) : (
                    <>
                        {wallet ? (
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Linked wallet</p>
                                <p className="break-all rounded-lg bg-[#fafbf7] px-4 py-3 font-mono text-sm">{wallet.address}</p>
                            </div>
                        ) : <p className="text-sm text-[#73776e]">No wallet is linked to your account yet.</p>}
                        <div role="status" aria-live="polite" className="space-y-2">
                            <p className={`flex items-center gap-2 text-sm font-medium ${mismatch ? "text-amber-800" : matches ? "text-[#657152]" : "text-[#73776e]"}`}>
                                {matches && <Check className="size-4" aria-hidden="true" />}
                                {connectionLabel}
                            </p>
                            {mismatch ? (
                                <div className="space-y-1 border-l-2 border-amber-300 pl-3 text-sm leading-6 text-[#73776e]">
                                    <p className="font-medium text-amber-800">Phantom is using a different wallet.</p>
                                    <p>Open the Phantom extension and select your linked wallet shown above. This page updates automatically when you switch.</p>
                                </div>
                            ) : matches ? (
                                <p className="text-sm text-[#73776e]">You’re ready to use this wallet for blockchain purchases.</p>
                            ) : connectedAddress ? (
                                <p className="text-sm text-[#73776e]">Verify ownership to link this wallet to your account.</p>
                            ) : (
                                <p className="text-sm text-[#73776e]">{wallet ? "Connect Phantom with your linked wallet. You won’t need to verify it again." : "Connect Phantom to detect your wallet address."}</p>
                            )}
                        </div>
                        {connectedAddress && mismatch && (
                            <details className="group text-sm text-[#73776e]">
                                <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-sm font-medium outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#657152] [&::-webkit-details-marker]:hidden">
                                    Detected Phantom wallet
                                    <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                                </summary>
                                <div className="mt-3 space-y-2">
                                    <p>This wallet is connected to this site, but it is not your account’s linked wallet.</p>
                                    <p className="break-all rounded-lg bg-[#fafbf7] px-4 py-3 font-mono text-sm">{connectedAddress}</p>
                                    <Button variant="outline" disabled={busy} onClick={() => { connect.reset(); bind.reset(); disconnect.mutate(); }}>
                                        {disconnect.isPending ? "Disconnecting…" : "Disconnect this detected wallet"}
                                    </Button>
                                    <p className="text-xs leading-5">This only disconnects the detected wallet from this site. Your linked wallet stays saved.</p>
                                </div>
                            </details>
                        )}
                        {connectedAddress && !wallet && (
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Detected Phantom wallet</p>
                                <p className="break-all rounded-lg bg-[#fafbf7] px-4 py-3 font-mono text-sm">{connectedAddress}</p>
                            </div>
                        )}
                        {!mismatch && <div className="flex flex-wrap items-center gap-3">
                            {!connectedAddress && <Button disabled={busy} onClick={() => { bind.reset(); disconnect.reset(); connect.mutate(); }} className="h-11 bg-[#30392b] px-5 text-white hover:bg-[#444f3a]">
                                {connect.isPending ? "Connecting…" : "Connect Phantom"}
                            </Button>}
                            {connectedAddress && !wallet && <Button disabled={busy} onClick={() => { connect.reset(); disconnect.reset(); bind.mutate(); }} className="h-11 bg-[#30392b] px-5 text-white hover:bg-[#444f3a]">
                                {bind.isPending ? "Approve in Phantom…" : "Verify & link wallet"}
                            </Button>}
                            {connectedAddress && <Button variant="outline" disabled={busy} onClick={() => { connect.reset(); bind.reset(); disconnect.mutate(); }} className="h-11">
                                {disconnect.isPending ? "Disconnecting…" : "Disconnect Phantom"}
                            </Button>}
                            {!connectedAddress && <a href="https://phantom.com/" target="_blank" rel="noreferrer" className="text-sm font-medium text-[#657152] underline underline-offset-4">Get Phantom</a>}
                        </div>}
                        {wallet && (status.data?.canChange ? (
                            <details className="text-sm text-[#73776e]">
                                <summary className="w-fit cursor-pointer font-medium text-[#30392b]">Change linked wallet</summary>
                                <div className="mt-3 space-y-3">
                                    <p>Switch to another wallet in Phantom, then verify it here to replace your linked wallet.</p>
                                    {mismatch && <Button variant="outline" disabled={busy} onClick={() => { connect.reset(); disconnect.reset(); bind.mutate(); }}>
                                        {bind.isPending ? "Approve in Phantom…" : "Verify & change linked wallet"}
                                    </Button>}
                                </div>
                            </details>
                        ) : (
                            <p className="text-sm text-[#73776e]">{status.data?.lockedReason === "NFT_OWNERSHIP" ? "Your linked wallet cannot be changed because this account owns NFTs." : "Your linked wallet cannot be changed while transactions are pending."}</p>
                        ))}
                        {!mismatch && <p className="text-xs leading-5 text-[#73776e]">{wallet ? "Your linked wallet stays saved when Phantom is not connected." : "Connecting Phantom does not link a wallet. Linking requires your approval with a message signature."}</p>}
                    </>
                )}
                {bind.isError && <p role="alert" className="text-sm text-red-700">{getErrorMessage(bind.error, bind.error.message || "Unable to verify your wallet. Please try again.")}</p>}
                {connect.isError && <p role="alert" className="text-sm text-red-700">{getErrorMessage(connect.error, "Unable to connect Phantom. Please try again.")}</p>}
                {disconnect.isError && <p role="alert" className="text-sm text-red-700">{getErrorMessage(disconnect.error, disconnect.error.message || "Unable to disconnect Phantom. Please try again.")}</p>}
            </div>
        </section>
    );
}
