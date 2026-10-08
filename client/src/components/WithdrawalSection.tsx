import { useState } from "react";
import { ArrowUpRight, History, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useWithdrawals, useRequestWithdrawal } from "../hooks/useSellerDashboard";
import { formatPrice, convertFiat } from "../lib/price";
import { useCurrencyStore } from "../stores/currencyStore";
import type { WithdrawalStatus } from "../types/seller";

const STATUS_STYLES: Record<WithdrawalStatus, string> = {
    PENDING: "bg-amber-50 text-amber-800",
    APPROVED: "bg-[#eceee7] text-[#555e49]",
    REJECTED: "bg-red-50 text-red-700",
    PAID: "bg-[#e3e8d8] text-[#425137]",
};

export default function WithdrawalSection() {
    const { data, isLoading, isError } = useWithdrawals();
    const requestWithdrawal = useRequestWithdrawal();
    const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
    const [amount, setAmount] = useState("");

    if (isLoading) {
        return <p role="status" className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading withdrawals…</p>;
    }
    if (isError || !data) {
        return <p role="alert" className="rounded-xl border border-border bg-card p-6 text-sm text-red-600">Failed to load withdrawals.</p>;
    }

    // Balances live in USD on the backend; show and accept input in the toggled
    // currency. The typed amount is converted back to USD before sending so the
    // backend keeps validating and storing against the same USD revenue base.
    const balanceInDisplay = convertFiat(data.availableBalance, "USD", displayCurrency);
    const numericAmount = parseFloat(amount);
    const isValid =
        !isNaN(numericAmount) && numericAmount > 0 && numericAmount <= balanceInDisplay;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!isValid) return;
        const amountUsd = convertFiat(numericAmount, displayCurrency, "USD");
        requestWithdrawal.mutate(amountUsd, {
            onSuccess: () => setAmount(""),
        });
    }

    return (
        <section aria-label="Withdrawals" className="min-w-0 space-y-5">
            <Card className="gap-5 rounded-xl bg-[#30392b] py-6 text-white ring-0 shadow-[0_8px_24px_-16px_rgba(37,40,35,0.4)]">
                <CardHeader className="px-6">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c5cfb5]">Available balance</h2>
                        <Wallet className="size-4 text-[#c5cfb5]" aria-hidden="true" />
                    </div>
                    <p className="mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums">{formatPrice(data.availableBalance, "USD", displayCurrency, { zeroAsFree: false })}</p>
                    <p className="mt-2 text-xs text-[#c5cfb5]">Ready to withdraw from your earnings.</p>
                </CardHeader>
                <CardContent className="border-t border-white/10 px-6 pt-5">
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <label htmlFor="withdrawal-amount" className="block text-xs font-medium text-[#e3e8d8]">Withdrawal amount ({displayCurrency})</label>
                        <Input
                            id="withdrawal-amount"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Amount to withdraw"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            aria-invalid={amount !== "" && !isValid}
                            aria-describedby={amount !== "" && !isValid ? "withdrawal-amount-error" : undefined}
                            className="h-11 border-white/20 bg-white/10 text-white shadow-none placeholder:text-[#c5cfb5] focus-visible:border-[#c5cfb5] focus-visible:ring-[#c5cfb5]/30"
                        />
                        {amount !== "" && !isValid && (
                            <p id="withdrawal-amount-error" className="text-xs text-[#ffd0c9]">
                                Enter an amount between {formatPrice(0, displayCurrency, displayCurrency, { zeroAsFree: false })} and{" "}
                                {formatPrice(balanceInDisplay, displayCurrency, displayCurrency, { zeroAsFree: false })}.
                            </p>
                        )}
                        {requestWithdrawal.isError && (
                            <p role="alert" className="text-xs text-[#ffd0c9]">Request failed. Please try again.</p>
                        )}
                        <Button type="submit" className="h-11 w-full bg-[#f7f7f2] text-[#30392b] hover:bg-[#e3e8d8]" disabled={!isValid || requestWithdrawal.isPending}>
                            {requestWithdrawal.isPending ? "Requesting…" : "Request withdrawal"}
                            <ArrowUpRight className="size-4" aria-hidden="true" />
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card className="gap-4 rounded-xl py-5 ring-border">
                <CardHeader className="flex flex-row items-center justify-between gap-3 px-5">
                    <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Withdrawal history</h2>
                    <History className="size-4 text-muted-foreground" aria-hidden="true" />
                </CardHeader>
                <CardContent className="px-5">
                    {data.withdrawals.length === 0 ? (
                        <p className="rounded-lg bg-background px-4 py-6 text-center text-xs leading-5 text-muted-foreground">No withdrawal requests yet.</p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {data.withdrawals.map((w) => (
                                <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                    <div>
                                        <p className="text-sm font-semibold tabular-nums">{formatPrice(w.amount, "USD", displayCurrency)}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">{new Date(w.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <span className={`rounded-md px-2 py-1 text-[9px] font-semibold tracking-wide ${STATUS_STYLES[w.status]}`}>{w.status}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </section>
    );
}
