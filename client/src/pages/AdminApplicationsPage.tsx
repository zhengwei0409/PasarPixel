import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useListApplications, useApproveApplication, useRejectApplication } from "../hooks/useSellerApplication";
import type { SellerApplicationWithUser } from "../types/sellerApplication";

export default function AdminApplicationsPage() {
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [adminNote, setAdminNote] = useState("");

    const { data: applications, isLoading } = useListApplications("PENDING");
    const { mutate: approve, isPending: isApproving } = useApproveApplication();
    const { mutate: reject, isPending: isRejecting } = useRejectApplication();

    const handleApprove = (id: number) => {
        approve(id);
    };

    const handleReject = (id: number) => {
        if (!adminNote.trim()) return;
        reject({ id, adminNote });
        setRejectingId(null);
        setAdminNote("");
    };

    if (isLoading) return <p className="p-8">Loading...</p>;

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-6">
            <h1 className="text-2xl font-bold">Seller Applications</h1>

            {applications?.length === 0 && (
                <p className="text-gray-500">No pending applications.</p>
            )}

            <div className="space-y-4">
                {applications?.map((app: SellerApplicationWithUser) => (
                    <div key={app.id} className="border rounded-lg p-6 space-y-3">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="font-semibold">{app.storeName}</p>
                                <p className="text-sm text-gray-500">{app.user.name}</p>
                            </div>
                            <p className="text-sm text-gray-400">
                                {new Date(app.createdAt).toLocaleDateString()}
                            </p>
                        </div>

                        <p className="text-sm">{app.reason}</p>

                        <div className="flex gap-4">
                            {app.portfolioLink && (
                                <a href={app.portfolioLink} target="_blank" rel="noreferrer"
                                    className="text-sm text-blue-600 underline">
                                    Portfolio
                                </a>
                            )}
                            <Link to={`/admin/applications/${app.id}`} className="text-sm text-blue-600 underline">
                                View details &amp; ID
                            </Link>
                        </div>

                        {rejectingId === app.id ? (
                            <div className="space-y-2 pt-2">
                                <Input
                                    placeholder="Reason for rejection"
                                    value={adminNote}
                                    onChange={(e) => setAdminNote(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleReject(app.id)}
                                        disabled={isRejecting || !adminNote.trim()}
                                    >
                                        Confirm Reject
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => { setRejectingId(null); setAdminNote(""); }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-2 pt-2">
                                <Button
                                    size="sm"
                                    onClick={() => handleApprove(app.id)}
                                    disabled={isApproving}
                                >
                                    Approve
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setRejectingId(app.id)}
                                >
                                    Reject
                                </Button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
