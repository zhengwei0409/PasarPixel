import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useVerifyLicense } from "../hooks/useOrders";

const schema = z.object({
    licenseKey: z.string().trim().min(1, "Enter a licence key"),
});

type VerifyForm = z.infer<typeof schema>;

// FR-3.5: public page. Anyone (no login) can verify that a licence key is
// genuine and see the non-sensitive details tied to it.
export default function VerifyPage() {
    const { mutate, data, isPending, isError } = useVerifyLicense();

    const { register, handleSubmit, formState: { errors } } = useForm<VerifyForm>({
        resolver: zodResolver(schema),
    });

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-full max-w-md space-y-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold">Verify a Licence</h1>
                    <p className="text-sm text-gray-500">
                        Enter a licence key to confirm it's a genuine PasarPixel purchase.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit((d) => mutate(d.licenseKey))}
                    className="space-y-4"
                >
                    <div className="space-y-1">
                        <Label>Licence Key</Label>
                        <Input {...register("licenseKey")} placeholder="e.g. clx3k9f0a0000..." />
                        {errors.licenseKey && (
                            <p className="text-sm text-red-500">{errors.licenseKey.message}</p>
                        )}
                    </div>

                    <Button type="submit" className="w-full" disabled={isPending}>
                        {isPending ? "Verifying..." : "Verify"}
                    </Button>
                </form>

                {isError && (
                    <p className="text-sm text-red-500 text-center">
                        Something went wrong. Please try again.
                    </p>
                )}

                {data && !data.valid && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-4 text-center">
                        <p className="font-semibold text-red-700">Not a valid licence</p>
                        <p className="text-sm text-red-600">
                            This key doesn't match any completed purchase.
                        </p>
                    </div>
                )}

                {data && data.valid && (
                    <div className="rounded-md border border-green-200 bg-green-50 p-4 space-y-2">
                        <p className="font-semibold text-green-700">Valid licence ✓</p>
                        <dl className="text-sm text-gray-700 space-y-1">
                            <div className="flex justify-between">
                                <dt className="text-gray-500">Asset</dt>
                                <dd className="font-medium">{data.assetTitle}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-500">Seller</dt>
                                <dd className="font-medium">{data.sellerName}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-500">Licence</dt>
                                <dd className="font-medium">{data.licenseType}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-500">Purchased</dt>
                                <dd className="font-medium">
                                    {new Date(data.purchasedAt).toLocaleDateString()}
                                </dd>
                            </div>
                        </dl>
                    </div>
                )}
            </div>
        </div>
    );
}
