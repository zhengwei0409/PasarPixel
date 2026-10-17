import { Button } from "@/components/ui/button";
import { useMasterMint } from "@/hooks/useMasterMint";
import { getErrorMessage } from "@/lib/errors";

const labels = { PREPARING: "Preparing NFT…", AWAITING_SIGNATURE: "Awaiting wallet approval", PENDING: "Waiting for Devnet confirmation…", READY: "Master NFT ready", FAILED: "Mint unsuccessful" };

export default function MasterMintPanel({ assetId }: { assetId: number }) {
    const { status, mint } = useMasterMint(assetId);
    const master = status.data?.master;
    const pending = master?.status === "PREPARING" || master?.status === "PENDING";
    return (
        <div className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
            <p className="font-medium" role="status">{master ? labels[master.status] : "Master NFT · Solana Devnet"}</p>
            {status.isPending ? <p className="text-muted-foreground">Loading NFT status…</p> : status.isError ? (
                <><p role="alert" className="text-red-700">{getErrorMessage(status.error, "Unable to load NFT status.")}</p><Button size="sm" variant="outline" onClick={() => void status.refetch()}>Try again</Button></>
            ) : <>
                {!status.data?.enabled && master?.status !== "READY" && <p className="text-muted-foreground">NFT minting is currently unavailable. Please try again later.</p>}
                {master?.status === "READY" ? <>
                    <p className="break-all font-mono text-xs text-muted-foreground">{master.assetAddress}</p>
                    <a href={master.explorerUrl} target="_blank" rel="noreferrer" className="font-medium text-[#657152] underline underline-offset-4">View Master NFT on Solana Explorer</a>
                </> : <>
                    <p className="text-muted-foreground">Create one non-transferable Master NFT in your bound wallet. The platform pays the Devnet fees. Your bound wallet cannot be replaced after minting.</p>
                    <Button size="sm" disabled={!status.data?.enabled || mint.isPending || pending} onClick={() => mint.mutate()}>
                        {mint.isPending ? "Approve in Phantom…" : pending ? "Mint in progress…" : master?.status === "FAILED" ? "Retry mint" : master?.status === "AWAITING_SIGNATURE" ? "Approve mint" : "Mint Master NFT"}
                    </Button>
                </>}
                {master?.error && <p role="alert" className="text-red-700">{master.error}</p>}
            </>}
            {mint.isError && <p role="alert" className="text-red-700">{getErrorMessage(mint.error, mint.error.message)}</p>}
        </div>
    );
}
