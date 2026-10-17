import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/useWallet";
import { getErrorMessage } from "@/lib/errors";

export default function WalletSection() {
    const { status, bind, disconnect, connectedAddress } = useWallet();
    const wallet = status.data?.wallet;
    const matches = Boolean(wallet && wallet.address === connectedAddress);
    const busy = bind.isPending || disconnect.isPending;
    return (
        <section aria-labelledby="wallet-heading" className="rounded-xl border border-[#e7e9e1] bg-white p-6 shadow-[0_2px_4px_-3px_rgba(37,40,35,0.15)] sm:p-9">
            <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e9ecdf] text-[#657152]">
                    <Wallet className="size-5" aria-hidden="true" />
                </div>
                <div>
                    <p className="mb-2 text-[10px] font-medium tracking-[0.18em] text-[#73776e] uppercase">Solana Devnet</p>
                    <h2 id="wallet-heading" className="text-xl font-semibold tracking-[-0.03em]">Phantom wallet</h2>
                    <p className="mt-2 text-sm leading-6 text-[#73776e]">Link one wallet to your account for blockchain purchases. Verify ownership with a signature. No payment is requested.</p>
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
                                <p className="text-sm font-medium">Bound wallet</p>
                                <p className="break-all rounded-lg bg-[#fafbf7] px-4 py-3 font-mono text-sm">{wallet.address}</p>
                                <p className="text-sm text-[#73776e]">{matches ? "Connected to your bound wallet." : "Your account binding is saved."}</p>
                            </div>
                        ) : <p className="text-sm text-[#73776e]">No wallet is linked to your account yet.</p>}
                        {connectedAddress && !matches && (
                            <div className="space-y-1 text-sm text-[#73776e]">
                                <p>Phantom is connected to {wallet ? "a different wallet" : "this wallet"}:</p>
                                <p className="break-all font-mono">{connectedAddress}</p>
                                {wallet && <p>Switch accounts in Phantom to use your bound wallet.</p>}
                            </div>
                        )}
                        {status.data?.lockedReason && <p className="text-sm text-[#73776e]">Your bound wallet cannot change while it holds NFTs or has pending transactions.</p>}
                        {wallet && status.data?.canChange && !matches && (
                            <p className="text-sm text-[#73776e]">Connecting and verifying another wallet will replace your current binding.</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3">
                            {!matches && <Button disabled={busy} onClick={() => { disconnect.reset(); bind.mutate(); }} className="h-11 bg-[#30392b] px-5 text-white hover:bg-[#444f3a]">
                                {bind.isPending ? "Approve in Phantom…" : "Connect & verify Phantom"}
                            </Button>}
                            {connectedAddress && <Button variant="outline" disabled={busy} onClick={() => { bind.reset(); disconnect.mutate(); }} className="h-11">
                                {disconnect.isPending ? "Disconnecting…" : "Disconnect Phantom"}
                            </Button>}
                            <a href="https://phantom.com/" target="_blank" rel="noreferrer" className="text-sm font-medium text-[#657152] underline underline-offset-4">Get Phantom</a>
                        </div>
                        <p className="text-xs leading-5 text-[#73776e]">Disconnecting Phantom keeps your account binding. Once you own an NFT, the bound wallet cannot be replaced in v1.</p>
                    </>
                )}
                {bind.isError && <p role="alert" className="text-sm text-red-700">{getErrorMessage(bind.error, bind.error.message || "Unable to verify your wallet. Please try again.")}</p>}
                {disconnect.isError && <p role="alert" className="text-sm text-red-700">{getErrorMessage(disconnect.error, disconnect.error.message || "Unable to disconnect Phantom. Please try again.")}</p>}
                {bind.isSuccess && <p role="status" className="text-sm text-[#657152]">Wallet ownership verified. Your account binding is saved.</p>}
            </div>
        </section>
    );
}
