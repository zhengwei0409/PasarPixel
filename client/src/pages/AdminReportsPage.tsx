import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useReports } from "../hooks/useReport";
import { getErrorMessage } from "../lib/errors";
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
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
