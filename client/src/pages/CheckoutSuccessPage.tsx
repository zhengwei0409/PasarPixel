import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { verifyCheckout } from "../services/checkoutService";

export default function CheckoutSuccessPage() {
    const [params] = useSearchParams();
    const orderIdParam = params.get("orderId");
    const orderId = orderIdParam ? parseInt(orderIdParam, 10) : NaN;
    const queryClient = useQueryClient();

    // Confirm payment via the backend instead of waiting on the async webhook.
    // Poll every 2s until the order is no longer PENDING (webhook or this verify
    // call, whichever lands first, settles it).
    const { data: status } = useQuery({
        queryKey: ["checkout", "verify", orderId],
        queryFn: () => verifyCheckout(orderId),
        enabled: Number.isInteger(orderId) && orderId > 0,
        refetchInterval: (query) =>
            query.state.data && query.state.data !== "PENDING" ? false : 2000,
    });

    // Once settled, refresh the cached cart and orders so the navbar/cart/history
    // reflect the cleared cart and the completed order.
    useEffect(() => {
        if (status && status !== "PENDING") {
            queryClient.invalidateQueries({ queryKey: ["cart"] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
        }
    }, [status, queryClient]);

    const completed = status === "COMPLETED";

    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <div className="max-w-md text-center space-y-4">
                <h1 className="text-3xl font-semibold">
                    {completed ? "Payment received 🎉" : "Confirming payment…"}
                </h1>
                <p className="text-gray-500">
                    {completed
                        ? "Thanks for your purchase! Your order is confirmed and your cart has been cleared."
                        : "We're confirming your payment. This usually takes a few seconds."}
                </p>
                <div className="flex gap-2 justify-center pt-2">
                    <Button asChild>
                        <Link to={Number.isInteger(orderId) ? `/orders/${orderId}` : "/orders"}>
                            View order
                        </Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link to="/marketplace">Keep browsing</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
