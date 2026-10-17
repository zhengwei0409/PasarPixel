import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { connectPhantom, getPhantom } from "@/lib/phantom";
import { signMasterMint } from "@/lib/masterMint";
import { getWalletStatus } from "@/services/walletService";
import { getMasterMint, prepareMasterMint, authorizeMasterMint } from "@/services/masterMintService";

export function useMasterMint(assetId: number) {
    const { user } = useAuth();
    const client = useQueryClient();
    const key = ["masterMint", user?.sub, assetId];
    const status = useQuery({ queryKey: key, queryFn: () => getMasterMint(assetId),
        refetchInterval: query => ["PREPARING", "AWAITING_SIGNATURE", "PENDING"].includes(query.state.data?.master?.status ?? "") ? 5000 : false });
    const mint = useMutation({
        mutationFn: async () => {
            const provider = getPhantom();
            if (!provider) throw new Error("Install Phantom and reload this page to mint your NFT.");
            const { publicKey } = await connectPhantom(provider);
            const wallet = await getWalletStatus();
            if (!wallet.wallet || publicKey.toString() !== wallet.wallet.address) throw new Error("Connect your bound wallet. You can bind a wallet in Settings.");
            const result = await prepareMasterMint(assetId);
            client.setQueryData(key, result);
            if (!result.master || result.master.status !== "AWAITING_SIGNATURE") return result;
            const approval = await signMasterMint(provider, result.master, window.location.origin);
            // Backend checks the authenticated account and current wallet again.
            return authorizeMasterMint(assetId, approval.authorizationId, approval.signature);
        },
        onSuccess: data => { client.setQueryData(key, data); },
        onSettled: () => { void client.invalidateQueries({ queryKey: ["wallet", user?.sub] }); void client.invalidateQueries({ queryKey: key }); },
    });
    return { status, mint };
}
