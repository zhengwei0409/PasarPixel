import { useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useSellerStripeStatus } from "../hooks/useSellerStripeStatus";
import { Button } from "./ui/button";

export default function SellerStripeReminder({ sellerId }: { sellerId: string }) {
    const stripeStatus = useSellerStripeStatus();
    const dismissalKey = `seller-stripe-reminder:${sellerId}`;
    const [dismissed, setDismissed] = useState(() => {
        try {
            return window.sessionStorage.getItem(dismissalKey) === "true";
        } catch {
            return false;
        }
    });

    if (dismissed || stripeStatus.isError ||
        (stripeStatus.data !== "not_connected" && stripeStatus.data !== "needs_onboarding")) {
        return null;
    }

    function dismiss() {
        setDismissed(true);
        try {
            window.sessionStorage.setItem(dismissalKey, "true");
        } catch {
            // The reminder still closes when browser storage is unavailable.
        }
    }

    return (
        <section aria-labelledby="stripe-reminder-title" className="flex items-start gap-2 rounded-xl border border-border bg-accent p-4 sm:gap-4">
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-5 gap-y-3">
                <div>
                    <h2 id="stripe-reminder-title" className="text-sm font-semibold">Set up card payments</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Complete Stripe setup so buyers can pay by card.</p>
                </div>
                <Button asChild variant="outline">
                    <Link to="/settings#stripe-payments">Go to payment settings</Link>
                </Button>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0" aria-label="Dismiss Stripe setup reminder" onClick={dismiss}>
                <X aria-hidden="true" />
            </Button>
        </section>
    );
}
