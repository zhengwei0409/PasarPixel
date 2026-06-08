import { RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useAssetReviewLogs } from "../hooks/useAssetReviewLogs";
import type { AssetReviewLogAdmin, AssetReviewLogAsset } from "../types/assetReviewLog";

// Show the admin's name, falling back to email, then to the raw id.
function adminLabel(admin: AssetReviewLogAdmin): string {
    return admin.name ?? admin.email ?? `User #${admin.userId}`;
}

// Show the asset title, falling back to its id (e.g. if the asset was deleted).
function assetLabel(asset: AssetReviewLogAsset): string {
    return asset.title ?? `Asset #${asset.id}`;
}

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function AssetReviewLogSection() {
    const { data, isLoading, isError, refetch, isFetching } = useAssetReviewLogs();

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Asset Review History</CardTitle>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isFetching}
                >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <p className="text-sm text-gray-500">Loading…</p>
                ) : isError ? (
                    <p className="text-sm text-red-600">Failed to load asset review history.</p>
                ) : !data || data.length === 0 ? (
                    <p className="text-sm text-gray-500">No asset reviews yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b text-gray-500">
                                <tr>
                                    <th className="py-2 pr-4 font-medium">When</th>
                                    <th className="py-2 pr-4 font-medium">Action</th>
                                    <th className="py-2 pr-4 font-medium">Asset</th>
                                    <th className="py-2 pr-4 font-medium">By Admin</th>
                                    <th className="py-2 font-medium">Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((log) => (
                                    <tr key={log.id} className="border-b last:border-0">
                                        <td className="py-2 pr-4 whitespace-nowrap text-gray-600">
                                            {formatDateTime(log.createdAt)}
                                        </td>
                                        <td className="py-2 pr-4">
                                            <span
                                                className={`rounded px-2 py-0.5 text-xs font-medium ${
                                                    log.action === "APPROVE"
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-red-100 text-red-700"
                                                }`}
                                            >
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="py-2 pr-4">{assetLabel(log.asset)}</td>
                                        <td className="py-2 pr-4">{adminLabel(log.admin)}</td>
                                        <td className="py-2 text-gray-600">{log.reason ?? "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
