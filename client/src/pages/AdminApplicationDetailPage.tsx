import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
    useApplication,
    useIdDocumentDownloadUrl,
    useApproveApplication,
    useRejectApplication,
} from "../hooks/useSellerApplication";
import { getErrorMessage } from "../lib/errors";

const statusColor: Record<string, string> = {
    PENDING: "text-yellow-600",
    APPROVED: "text-green-600",
    REJECTED: "text-red-600",
    REVOKED: "text-gray-600",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="font-medium">{value ?? "—"}</p>
        </div>
    );
}

export default function AdminApplicationDetailPage() {
    const { id } = useParams<{ id: string }>();
    const applicationId = Number(id);
    const navigate = useNavigate();

    const { data: app, isLoading, error } = useApplication(applicationId);
    const { mutateAsync: fetchIdUrl, isPending: isLoadingId } = useIdDocumentDownloadUrl();
    const { mutate: approve, isPending: isApproving } = useApproveApplication();
    const { mutate: reject, isPending: isRejecting } = useRejectApplication();

    const [idUrl, setIdUrl] = useState<string | null>(null);
    const [idError, setIdError] = useState<string | null>(null);
    const [showReject, setShowReject] = useState(false);
    const [adminNote, setAdminNote] = useState("");

    if (isLoading) return <p className="p-8">Loading...</p>;
    if (error || !app) return <p className="p-8 text-red-500">{error ? getErrorMessage(error) : "Not found"}</p>;

    const isPdf = app.idDocumentKey?.toLowerCase().endsWith(".pdf");

    const handleViewId = async () => {
        setIdError(null);
        try {
            const url = await fetchIdUrl(applicationId);
            setIdUrl(url);
        } catch (e) {
            setIdError(getErrorMessage(e));
        }
    };

    const handleApprove = () => {
        approve(applicationId, { onSuccess: () => navigate("/admin/applications") });
    };

    const handleReject = () => {
        if (!adminNote.trim()) return;
        reject({ id: applicationId, adminNote }, { onSuccess: () => navigate("/admin/applications") });
    };

    return (
        <div className="max-w-3xl mx-auto p-8 space-y-6">
            <Link to="/admin/applications" className="text-sm text-blue-600 underline">
                ← Back to applications
            </Link>

            <div className="flex items-start justify-between">
                <h1 className="text-2xl font-bold">{app.storeName}</h1>
                <p className={`font-semibold ${statusColor[app.status]}`}>{app.status}</p>
            </div>

            <div className="border rounded-lg p-6 grid grid-cols-2 gap-4">
                <Field label="Applicant" value={app.user.name} />
                <Field label="Email" value={app.user.email} />
                <Field label="Full Legal Name" value={app.fullName} />
                <Field
                    label="Date of Birth"
                    value={app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString() : null}
                />
                <div className="col-span-2">
                    <Field label="Address" value={app.address} />
                </div>
                <div className="col-span-2">
                    <Field label="Reason" value={app.reason} />
                </div>
                <div className="col-span-2">
                    <Field
                        label="Portfolio"
                        value={
                            app.portfolioLink ? (
                                <a href={app.portfolioLink} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                                    {app.portfolioLink}
                                </a>
                            ) : null
                        }
                    />
                </div>
                <Field label="Submitted" value={new Date(app.createdAt).toLocaleString()} />
            </div>

            <div className="border rounded-lg p-6 space-y-4">
                <h2 className="font-semibold">ID Document</h2>
                {!app.idDocumentKey ? (
                    <p className="text-sm text-gray-500">No ID document was uploaded.</p>
                ) : !idUrl ? (
                    <Button size="sm" onClick={handleViewId} disabled={isLoadingId}>
                        {isLoadingId ? "Loading..." : "View ID Document"}
                    </Button>
                ) : isPdf ? (
                    <div className="space-y-2">
                        <iframe src={idUrl} title="ID document" className="w-full h-[600px] border rounded" />
                        <a href={idUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
                            Open in new tab
                        </a>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <img src={idUrl} alt="ID document" className="max-w-full rounded border" />
                        <a href={idUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
                            Open in new tab
                        </a>
                    </div>
                )}
                {idError && <p className="text-sm text-red-500">{idError}</p>}
            </div>

            {app.status === "PENDING" && (
                <div className="border rounded-lg p-6 space-y-3">
                    {showReject ? (
                        <div className="space-y-2">
                            <Input
                                placeholder="Reason for rejection"
                                value={adminNote}
                                onChange={(e) => setAdminNote(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <Button variant="destructive" size="sm" onClick={handleReject} disabled={isRejecting || !adminNote.trim()}>
                                    Confirm Reject
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => { setShowReject(false); setAdminNote(""); }}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleApprove} disabled={isApproving}>
                                Approve
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setShowReject(true)}>
                                Reject
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
