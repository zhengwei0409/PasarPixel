import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";

export default function CheckoutSuccessPage() {
    const [params] = useSearchParams();
    const orderId = params.get("orderId");
    const queryClient = useQueryClient();

    // The webhook clears the cart server-side; refresh the cached cart so the
    // navbar/cart page reflect that it's now empty.
    useEffect(() => {
        queryClient.invalidateQueries({ queryKey: ["cart"] });
    }, [queryClient]);

    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <div className="max-w-md text-center space-y-4">
                <h1 className="text-3xl font-semibold">Payment received 🎉</h1>
                <p className="text-gray-500">
                    Thanks for your purchase! We're processing your order
                    {orderId ? ` (#${orderId})` : ""}. Your purchased assets will be
                    available shortly.
                </p>
                <div className="flex gap-2 justify-center pt-2">
                    <Button asChild>
                        <Link to="/dashboard">Go to Dashboard</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link to="/marketplace">Keep browsing</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
