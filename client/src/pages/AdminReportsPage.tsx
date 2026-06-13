import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";
import ReasonPicker from "../components/ReasonPicker";
import { useReports, useResolveReport } from "../hooks/useReport";
import { getErrorMessage } from "../lib/errors";
import { ASSET_TAKEDOWN_REASONS } from "../lib/reportReasons";
import type { ReportStatus } from "../types/report";

const STATUS_STYLES: Record<ReportStatus, string> = {
    PENDING: "bg-yellow-200 text-yellow-900",
    TAKEN_DOWN: "bg-red-200 text-red-900",
    DISMISSED: "bg-gray-200 text-gray-700",
};

const STATUS_LABELS: Record<ReportStatus, string> = {
    PENDING: "Pending",
    TAKEN_DOWN: "Taken down",
    DISMISSED: "Dismissed",
};

export default function AdminReportsPage() {
    const { data: reports, isLoading, error } = useReports();
    const { mutate: resolve, isPending, error: resolveError } = useResolveReport();

    // The report awaiting a take-down confirmation (null = dialog closed).
    const [takingDownId, setTakingDownId] = useState<number | null>(null);
    // Reason shown to the seller; required before take-down can be confirmed.
    const [takedownReason, setTakedownReason] = useState("");

    const closeDialog = () => {
        setTakingDownId(null);
        setTakedownReason("");
    };

    const handleConfirmTakeDown = () => {
        if (takingDownId == null || !takedownReason.trim()) return;
        resolve(
            {
                reportId: takingDownId,
                action: "take_down",
                reason: takedownReason.trim(),
            },
            { onSuccess: () => closeDialog() },
        );
    };

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <h1 className="text-2xl font-bold">Reported Listings</h1>

                {isLoading && <p className="text-gray-600">Loading...</p>}
                {error && <p className="text-red-500">{getErrorMessage(error)}</p>}

                {reports && reports.length === 0 && (
                    <Card>
                        <CardContent className="py-12 text-center text-gray-600">
                            No reports have been submitted.
                        </CardContent>
                    </Card>
                )}

                <div className="space-y-3">
                    {reports?.map((report) => (
                        <Card key={report.id}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg">
                                        <Link
                                            to={`/assets/${report.asset.id}`}
                                            className="hover:underline"
                                        >
                                            {report.asset.title ?? "(asset unavailable)"}
                                        </Link>
                                    </CardTitle>
                                    <span
                                        className={`text-xs font-medium px-2 py-1 rounded ${STATUS_STYLES[report.status]}`}
                                    >
                                        {STATUS_LABELS[report.status]}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="text-sm text-gray-600 flex flex-wrap gap-x-6 gap-y-1">
                                    <span>
                                        Reported by: {report.reporter.name ?? "Unknown"}
                                    </span>
                                    <span>
                                        {new Date(report.createdAt).toLocaleDateString()}
                                    </span>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-500">Reason</p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                        {report.reason}
                                    </p>
                                </div>

                                {report.status === "PENDING" && (
                                    <div className="flex gap-2 pt-1">
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={isPending}
                                            onClick={() => setTakingDownId(report.id)}
                                        >
                                            Take down
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={isPending}
                                            onClick={() =>
                                                resolve({
                                                    reportId: report.id,
                                                    action: "dismiss",
                                                })
                                            }
                                        >
                                            Dismiss
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            <Dialog
                open={takingDownId != null}
                onOpenChange={(open) => {
                    if (!open) closeDialog();
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Take down this listing?</DialogTitle>
                        <DialogDescription>
                            The asset will be removed from the marketplace. The seller will
                            be notified with the reason you choose below. This resolves the
                            report.
                        </DialogDescription>
                    </DialogHeader>

                    <ReasonPicker
                        key={takingDownId ?? "closed"}
                        presets={ASSET_TAKEDOWN_REASONS}
                        onChange={setTakedownReason}
                        placeholder="Select a reason for the seller"
                    />

                    {resolveError && (
                        <p className="text-sm text-red-500">
                            {getErrorMessage(resolveError)}
                        </p>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={isPending || !takedownReason.trim()}
                            onClick={handleConfirmTakeDown}
                        >
                            {isPending ? "Taking down..." : "Confirm take down"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
