import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useSellerStripeStatus } from "../hooks/useSellerStripeStatus";
import { startSellerStripeOnboarding } from "../services/sellerService";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";

export default function SellerStripePayments() {
    const { hash } = useLocation();
    const [params] = useSearchParams();
    const heading = useRef<HTMLHeadingElement>(null);
    const stripeStatus = useSellerStripeStatus();
    useEffect(() => {
        if (hash === "#stripe-payments") {
            heading.current?.focus({ preventScroll: true });
            heading.current?.scrollIntoView({ block: "nearest" });
        }
    }, [hash]);
    const onboarding = useMutation({
        mutationFn: startSellerStripeOnboarding,
        onSuccess: (url) => window.location.assign(url),
        onError: () => { void stripeStatus.refetch(); },
    });
    const status = stripeStatus.data;
    const error = isAxiosError<{ error?: string }>(onboarding.error) ? onboarding.error.response?.data?.error : undefined;
    const canStart = status === "not_connected" || status === "needs_onboarding";

    return (
        <Card id="stripe-payments" className="gap-3 rounded-xl py-5 ring-border">
            <CardHeader className="px-5">
                <h2 ref={heading} tabIndex={-1} className="scroll-mt-24 text-lg font-semibold">Stripe payments</h2>
            </CardHeader>
            <CardContent className="space-y-3 px-5 text-sm">
                {stripeStatus.isPending && <p role="status" className="text-muted-foreground">Checking Stripe setup…</p>}
                {stripeStatus.isError && (
                    <>
                        <p role="alert" className="text-destructive">Could not check your Stripe setup.</p>
                        <Button variant="outline" onClick={() => void stripeStatus.refetch()}>Try again</Button>
                    </>
                )}
                {!stripeStatus.isError && status === "unavailable" && <p className="text-muted-foreground">Stripe Sandbox is unavailable.</p>}
                {!stripeStatus.isError && canStart && (
                    <>
                        <p className="text-muted-foreground">
                            {params.get("stripe") === "refresh"
                                ? "Your Stripe link expired. Continue setup to open a new link."
                                : "Complete Stripe setup to receive card payments from buyers."}
                        </p>
                        <Button disabled={onboarding.isPending} onClick={() => onboarding.mutate()}>
                            {onboarding.isPending ? "Opening Stripe…" : status === "not_connected" ? "Connect Stripe" : "Continue Stripe setup"}
                        </Button>
                    </>
                )}
                {onboarding.isError && <p role="alert" className="text-destructive">{error ?? "Could not open Stripe setup. Try again."}</p>}
                {!stripeStatus.isError && status === "ready" && (
                    <>
                        <p className="text-muted-foreground">Card payments are enabled. Check your balance and bank payouts in Stripe.</p>
                        <a href="https://dashboard.stripe.com/" target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">Open Stripe Dashboard</a>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
