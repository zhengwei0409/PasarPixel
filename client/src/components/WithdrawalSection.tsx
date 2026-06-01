import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useWithdrawals, useRequestWithdrawal } from "../hooks/useSellerDashboard";
import { formatPrice } from "../lib/price";
import type { WithdrawalStatus } from "../types/seller";

const STATUS_STYLES: Record<WithdrawalStatus, string> = {
    PENDING: "bg-yellow-200 text-yellow-900",
    APPROVED: "bg-blue-200 text-blue-900",
    REJECTED: "bg-red-200 text-red-900",
    PAID: "bg-green-200 text-green-900",
};

export default function WithdrawalSection() {
    const { data, isLoading, isError } = useWithdrawals();
    const requestWithdrawal = useRequestWithdrawal();
    const [amount, setAmount] = useState("");

    if (isLoading) {
        return <p className="text-sm text-gray-500">Loading withdrawals…</p>;
    }
    if (isError || !data) {
        return <p className="text-sm text-red-600">Failed to load withdrawals.</p>;
    }

    const balance = data.availableBalance;
    const numericAmount = parseFloat(amount);
    const isValid =
        !isNaN(numericAmount) && numericAmount > 0 && numericAmount <= balance;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!isValid) return;
        requestWithdrawal.mutate(numericAmount, {
            onSuccess: () => setAmount(""),
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Withdrawals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <p className="text-sm text-gray-600">Available balance</p>
                    <p className="text-2xl font-bold">{formatPrice(balance, "USD")}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-2">
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Amount to withdraw"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                        <Button type="submit" disabled={!isValid || requestWithdrawal.isPending}>
                            {requestWithdrawal.isPending ? "Requesting…" : "Request"}
                        </Button>
                    </div>
                    {amount !== "" && !isValid && (
                        <p className="text-xs text-red-600">
                            Enter an amount between {formatPrice(0, "USD")} and{" "}
                            {formatPrice(balance, "USD")}.
                        </p>
                    )}
                    {requestWithdrawal.isError && (
                        <p className="text-xs text-red-600">
                            Request failed. Please try again.
                        </p>
                    )}
                </form>

                <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700">History</h3>
                    {data.withdrawals.length === 0 ? (
                        <p className="text-sm text-gray-500">No withdrawal requests yet.</p>
                    ) : (
                        <ul className="divide-y">
                            {data.withdrawals.map((w) => (
                                <li
                                    key={w.id}
                                    className="flex items-center justify-between py-2"
                                >
                                    <div>
                                        <p className="font-medium">{formatPrice(w.amount, "USD")}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(w.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <span
                                        className={`text-xs font-medium px-2 py-1 rounded ${STATUS_STYLES[w.status]}`}
                                    >
                                        {w.status}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
