import { ArrowRight, CircleAlert, Loader2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FloatingShapes from "../components/home/FloatingShapes";
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
    const { mutate, data, isPending, isError, reset } = useVerifyLicense();

    const { register, handleSubmit, formState: { errors } } = useForm<VerifyForm>({
        resolver: zodResolver(schema),
    });

    return (
        <main className="relative isolate flex min-h-[calc(100dvh-73px)] flex-col bg-[#f7f7f2] text-[#252823]">
            <FloatingShapes />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_at_50%_0%,#e3e8d8_0%,transparent_70%)]" />

            <section aria-labelledby="verify-heading" className="relative z-10 mx-auto w-full max-w-[560px] flex-1 px-4 py-14 sm:px-8 sm:py-20">
                <div className="text-center">
                    <div className="mx-auto mb-6 flex size-12 items-center justify-center rounded-2xl border border-[#dfe4d6] bg-[#eceee7] text-[#657152]">
                        <ShieldCheck className="size-6" strokeWidth={1.5} aria-hidden="true" />
                    </div>
                    <p className="mb-4 text-[10px] font-medium tracking-[0.22em] text-[#74796c]">PURCHASE WITH CONFIDENCE</p>
                    <h1 id="verify-heading" className="text-4xl leading-[1.1] font-semibold tracking-[-0.055em] sm:text-5xl">
                        Verify your <span className="font-normal text-[#7a8568] italic">licence.</span>
                    </h1>
                </div>

                <div className="mt-9 rounded-2xl border border-[#dfe4d6] bg-white p-6 shadow-[0_8px_24px_-16px_rgba(37,40,35,0.2)] sm:p-8">
                    <form onSubmit={handleSubmit((d) => mutate(d.licenseKey))} className="space-y-5" aria-busy={isPending}>
                        <div className="space-y-2.5">
                            <Label htmlFor="license-key" className="text-sm font-medium text-[#30392b]">Licence key</Label>
                            <Input
                                {...register("licenseKey", { onChange: () => reset() })}
                                id="license-key"
                                placeholder="Paste your licence key"
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                disabled={isPending}
                                aria-invalid={!!errors.licenseKey}
                                aria-describedby={errors.licenseKey ? "license-key-error" : "license-key-hint"}
                                className="h-12 rounded-lg border-[#dfe4d6] bg-[#fafbf7] px-3.5 text-sm text-[#252823] shadow-none placeholder:text-[#85897f] focus-visible:border-[#7a8568] focus-visible:ring-[#7a8568]/20"
                            />
                            {errors.licenseKey ? (
                                <p id="license-key-error" role="alert" className="text-xs text-red-700">{errors.licenseKey.message}</p>
                            ) : (
                                <p id="license-key-hint" className="text-xs leading-5 text-[#73776e]">Find this key on your licence certificate.</p>
                            )}
                        </div>

                        <Button type="submit" className="h-11 w-full gap-2 rounded-lg bg-[#30392b] text-sm font-medium text-white hover:bg-[#444f3a] focus-visible:border-[#7a8568] focus-visible:ring-[#7a8568]/30 motion-reduce:transition-none" disabled={isPending}>
                            {isPending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
                            {isPending ? "Verifying…" : "Verify licence"}
                        </Button>
                    </form>

                    <div aria-live="polite" aria-atomic="true">
                        {isError && (
                            <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                                <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-700" aria-hidden="true" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-red-800">Unable to verify</p>
                                    <p className="text-xs leading-5 text-red-700">Something went wrong. Please try again.</p>
                                </div>
                            </div>
                        )}

                        {data && !isPending && !isError && !data.valid && (
                            <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                                <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-700" aria-hidden="true" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-red-800">Licence not found</p>
                                    <p className="text-xs leading-5 text-red-700">This key doesn’t match a completed purchase. Check the key and try again.</p>
                                </div>
                            </div>
                        )}

                        {data && !isPending && !isError && data.valid && (
                            <div className="mt-6 rounded-xl border border-[#dfe4d6] bg-[#f7f9f2] p-5">
                                <div className="flex items-start gap-3 border-b border-[#dfe4d6] pb-4">
                                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#657152]" aria-hidden="true" />
                                    <div>
                                        <p className="text-sm font-semibold text-[#30392b]">Verified licence</p>
                                        <p className="mt-1 text-xs leading-5 text-[#73776e]">This asset is a genuine PasarPixel purchase.</p>
                                    </div>
                                </div>
                                <dl className="mt-4 space-y-3 text-sm">
                                    {[
                                        ["Asset", data.assetTitle],
                                        ["Seller", data.sellerName],
                                        ["Licence", data.licenseType],
                                        ["Purchased", new Date(data.purchasedAt).toLocaleDateString()],
                                    ].map(([label, value]) => (
                                        <div key={label} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4">
                                            <dt className="text-[#73776e]">{label}</dt>
                                            <dd className="text-right font-medium break-words text-[#30392b]">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        )}
                    </div>
                </div>

                <p className="mt-5 text-center text-xs text-[#73776e]">No account needed. Just your licence key.</p>
                <div className="mt-8 text-center">
                    <Link to="/marketplace" className="inline-flex items-center gap-2 rounded-sm text-xs font-medium text-[#657152] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]">
                        Explore the marketplace <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                </div>
            </section>

            <footer className="relative z-10 border-t border-[#e7e9e1] px-4 py-6 text-center text-xs text-[#85897f]">
                PasarPixel <span className="mx-2 text-[#c5cfb5]">/</span> Creative assets. New possibilities.
            </footer>
        </main>
    );
}
