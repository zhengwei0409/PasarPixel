import { useState } from "react";
import { Button } from "../components/ui/button";
import { useListApplications, useRevokeSeller, useReinstateSeller } from "../hooks/useSellerApplication";
import type { SellerApplicationWithUser } from "../types/sellerApplication";

export default function AdminSellersPage() {
    const [confirmingRevokeId, setConfirmingRevokeId] = useState<number | null>(null);

    const { data: active, isLoading: loadingActive } = useListApplications("APPROVED");
    const { data: revoked, isLoading: loadingRevoked } = useListApplications("REVOKED");
    const { mutate: revoke, isPending: isRevoking } = useRevokeSeller();
    const { mutate: reinstate, isPending: isReinstating } = useReinstateSeller();

    const handleRevoke = (userId: number) => {
        revoke(userId);
        setConfirmingRevokeId(null);
    };

    if (loadingActive || loadingRevoked) return <p className="p-8">Loading...</p>;

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-10">
            <h1 className="text-2xl font-bold">Manage Sellers</h1>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold">Active Sellers</h2>

                {active?.length === 0 && (
                    <p className="text-gray-500">No active sellers.</p>
                )}

                {active?.map((seller: SellerApplicationWithUser) => (
                    <div key={seller.id} className="border rounded-lg p-6 space-y-3">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="font-semibold">{seller.storeName}</p>
                                <p className="text-sm text-gray-500">{seller.user.name}</p>
                            </div>
                            <p className="text-sm text-gray-400">
                                Approved {seller.reviewedAt ? new Date(seller.reviewedAt).toLocaleDateString() : "—"}
                            </p>
                        </div>

                        {confirmingRevokeId === seller.userId ? (
                            <div className="space-y-2 pt-2">
                                <p className="text-sm text-red-600">
                                    Revoke seller role? Their published listings will be hidden from the marketplace.
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleRevoke(seller.userId)}
                                        disabled={isRevoking}
                                    >
                                        Confirm Revoke
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setConfirmingRevokeId(null)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-2 pt-2">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setConfirmingRevokeId(seller.userId)}
                                >
                                    Revoke Seller
                                </Button>
                            </div>
                        )}
                    </div>
                ))}
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold">Revoked Sellers</h2>

                {revoked?.length === 0 && (
                    <p className="text-gray-500">No revoked sellers.</p>
                )}

                {revoked?.map((seller: SellerApplicationWithUser) => (
                    <div key={seller.id} className="border rounded-lg p-6 space-y-3">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="font-semibold">{seller.storeName}</p>
                                <p className="text-sm text-gray-500">{seller.user.name}</p>
                            </div>
                            <p className="text-sm text-gray-400">Revoked</p>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button
                                size="sm"
                                onClick={() => reinstate(seller.userId)}
                                disabled={isReinstating}
                            >
                                Reinstate Seller
                            </Button>
                        </div>
                    </div>
                ))}
            </section>
        </div>
    );
}
