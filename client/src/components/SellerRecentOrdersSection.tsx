import { Download, ShoppingBag } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { useSellerRecentOrders } from "../hooks/useSellerDashboard";
import { useCurrencyStore } from "../stores/currencyStore";
import { convertFiat, formatPrice } from "../lib/price";
import { serializeCsv } from "../lib/csv";
import type { PaymentStatus } from "../types/order";

const statusStyles: Record<PaymentStatus, string> = {
    COMPLETED: "bg-[#e3e8d8] text-[#425137]",
    PENDING: "bg-amber-50 text-amber-800",
    FAILED: "bg-red-50 text-red-700",
    REFUNDED: "bg-secondary text-secondary-foreground",
};

export default function SellerRecentOrdersSection() {
    const { data, isLoading, isError } = useSellerRecentOrders();
    const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
    const items = data?.items ?? [];

    function exportCsv() {
        const rows = [
            ["Order ID", "Buyer", "Product", "License type", "Date (UTC)", "Amount", "Currency", "Payment status"],
            ...items.map((item) => [
                String(item.orderId), item.buyerName, item.product, item.licenseType,
                new Date(item.createdAt).toISOString(),
                convertFiat(Number(item.amount), item.currency, displayCurrency).toFixed(2),
                displayCurrency, item.paymentStatus,
            ]),
        ];
        const url = URL.createObjectURL(new Blob([serializeCsv(rows)], { type: "text/csv;charset=utf-8;" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "pasarpixel-recent-orders.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return (
        <Card className="min-w-0 gap-5 rounded-xl py-6 ring-border">
            <CardHeader className="px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">Recent orders</h2>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Your latest 10 asset purchases. CSV exports the rows shown.</p>
                    </div>
                    <Button variant="ghost" onClick={exportCsv} disabled={isLoading || isError || items.length === 0} className="text-xs text-secondary-foreground">
                        <Download className="size-3.5" aria-hidden="true" />Export CSV
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="px-0">
                {isLoading ? (
                    <p role="status" className="px-6 py-8 text-sm text-muted-foreground">Loading recent orders…</p>
                ) : isError ? (
                    <p role="alert" className="px-6 py-8 text-sm text-red-600">Failed to load recent orders.</p>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center px-6 py-8 text-center">
                        <ShoppingBag className="mb-3 size-7 text-[#7a8568]" aria-hidden="true" />
                        <p className="text-sm font-medium">No orders yet</p>
                        <p className="mt-2 text-xs text-muted-foreground">New purchases of your assets will appear here.</p>
                    </div>
                ) : (
                    <div role="region" aria-label="Recent orders table" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-ring">
                        <table className="w-full text-left text-xs">
                            <caption className="sr-only">Latest asset purchases belonging to your store</caption>
                            <thead className="bg-background text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                                <tr>
                                    {["Buyer", "Product", "License", "Date", `Amount (${displayCurrency})`, "Status"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-semibold first:pl-6 last:pr-6">{label}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {items.map((item) => (
                                    <tr key={item.id} className="hover:bg-background/70">
                                        <td className="min-w-32 py-4 pr-4 pl-6"><p className="font-medium">{item.buyerName}</p><p className="mt-1 text-[10px] text-muted-foreground">Order #{item.orderId}</p></td>
                                        <td className="min-w-36 px-4 py-4 font-medium">{item.product}</td>
                                        <td className="px-4 py-4 text-muted-foreground">{item.licenseType === "COMMERCIAL" ? "Commercial" : "Personal"}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-muted-foreground"><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString()}</time></td>
                                        <td className="px-4 py-4 font-semibold whitespace-nowrap tabular-nums">{formatPrice(item.amount, item.currency, displayCurrency, { zeroAsFree: false })}</td>
                                        <td className="py-4 pr-6 pl-4"><span className={`rounded-md px-2 py-1 text-[9px] font-semibold ${statusStyles[item.paymentStatus]}`}>{item.paymentStatus}</span></td>
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
