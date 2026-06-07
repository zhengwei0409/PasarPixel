import { useState } from "react";
import { Button } from "../components/ui/button";
import { useListApplications, useRevokeSeller } from "../hooks/useSellerApplication";
import type { SellerApplicationWithUser } from "../types/sellerApplication";

export default function AdminSellersPage() {
    const [confirmingId, setConfirmingId] = useState<number | null>(null);

    const { data: sellers, isLoading } = useListApplications("APPROVED");
    const { mutate: revoke, isPending: isRevoking } = useRevokeSeller();

    const handleRevoke = (userId: number) => {
        revoke(userId);
        setConfirmingId(null);
    };

    if (isLoading) return <p className="p-8">Loading...</p>;

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-6">
            <h1 className="text-2xl font-bold">Manage Sellers</h1>

            {sellers?.length === 0 && (
                <p className="text-gray-500">No active sellers.</p>
            )}

            <div className="space-y-4">
                {sellers?.map((seller: SellerApplicationWithUser) => (
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

                        {confirmingId === seller.userId ? (
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
                                        onClick={() => setConfirmingId(null)}
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
                                    onClick={() => setConfirmingId(seller.userId)}
                                >
                                    Revoke Seller
                                </Button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
