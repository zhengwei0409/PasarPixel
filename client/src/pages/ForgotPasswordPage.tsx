import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowUpRight, Mail } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useForgotPassword } from "../hooks/useForgotPassword";

const schema = z.object({
    email: z.string().email("Invalid email"),
});

type ForgotPasswordForm = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
    const { mutate: sendResetLink, isPending, isSuccess, isError } = useForgotPassword();

    const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordForm>({
        resolver: zodResolver(schema),
    });

    return (
        <main className="flex min-h-[calc(100dvh-73px)] items-center bg-[#f7f7f2] px-4 py-8 text-[#252823] sm:px-8 sm:py-12 lg:px-12">
            <div className="mx-auto grid w-full max-w-[1200px] items-center gap-16 lg:grid-cols-[1.15fr_1fr] xl:gap-24">
                <section className="hidden min-w-0 flex-col items-start lg:flex" aria-labelledby="forgot-password-welcome">
                    <p className="mb-7 text-xs font-medium tracking-[0.2em] text-[#74796c]">A SPACE FOR YOUR NEXT IDEA</p>
                    <h2 id="forgot-password-welcome" className="text-[clamp(3rem,5vw,4.5rem)] leading-[1.06] font-medium tracking-[-0.055em]">
                        A fresh start.<br />
                        <span className="text-[#7a8568]">Keep creating.</span>
                    </h2>
                    <p className="mt-6 max-w-[360px] text-base leading-7 text-[#73776e]">
                        Reset your password and get back to discovering inspiring assets and bringing your ideas to life.
                    </p>

                    <div className="relative my-10 h-[240px] w-full max-w-[420px] overflow-hidden" aria-hidden="true">
                        <div className="absolute top-4 left-14 size-[190px] rotate-[-18deg] rounded-[36px] border border-[#d4d8cb] bg-[#e9ecdf]" />
                        <div className="absolute top-12 left-36 size-[160px] rotate-[12deg] rounded-[30px] border border-[#a9b39a] bg-[#c5cfb5]" />
                        <div className="absolute top-20 left-5 size-[132px] rounded-full border border-[#c3c8bb] bg-[#f7f7f2]/80" />
                        <div className="absolute top-6 right-10 size-3 rounded-full bg-[#9ca98c]" />
                        <div className="absolute right-14 bottom-6 size-7 rounded-full border border-[#b6bea9]" />
                    </div>

                    <Link to="/marketplace" className="group inline-flex items-center gap-2 rounded-sm text-sm font-medium text-[#555e49] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]">
                        Explore the marketplace
                        <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                    </Link>
                </section>

                <div className="mx-auto w-full max-w-[460px] lg:mr-0">
                    <Link to="/" className="mb-5 inline-flex items-center gap-2 rounded-sm text-xs font-medium text-[#73776e] transition-colors hover:text-[#252823] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]">
                        <ArrowLeft className="size-3.5" aria-hidden="true" />
                        Back to home
                    </Link>

                    <div className="rounded-2xl border border-[#e7e9e1] bg-white px-6 py-8 shadow-[0_8px_40px_-20px_rgba(37,40,35,0.15)] sm:px-10 sm:py-10">
                        {isSuccess || isError ? (
                            <div role="status" className="text-center">
                                <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-full border border-[#d4d8cb] bg-[#e9ecdf] text-[#657152]">
                                    <Mail className="size-6" aria-hidden="true" />
                                </div>
                                <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Check your email</h1>
                                <p className="mt-3 text-sm leading-6 text-[#73776e]">
                                    If that email is registered, you'll receive a reset link shortly.
                                </p>
                                <Button asChild className="mt-8 h-12 w-full rounded-lg bg-[#30392b] text-sm font-medium text-white hover:bg-[#444f3a] focus-visible:ring-[#7a8568]/30">
                                    <Link to="/login">Back to sign in</Link>
                                </Button>
                            </div>
                        ) : (
                            <>
                                <header className="mb-8 space-y-2">
                                    <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Forgot password?</h1>
                                    <p className="text-sm leading-relaxed text-[#73776e]">Enter your email and we'll send you a reset link.</p>
                                </header>

                                <form onSubmit={handleSubmit((data) => sendResetLink(data.email))} noValidate aria-busy={isPending}>
                                    <div className="space-y-2.5">
                                        <Label htmlFor="forgot-password-email" className="text-sm font-medium text-[#454a40]">Email address</Label>
                                        <Input
                                            {...register("email")}
                                            id="forgot-password-email"
                                            type="email"
                                            autoComplete="email"
                                            placeholder="name@domain.com"
                                            disabled={isPending}
                                            aria-invalid={!!errors.email}
                                            aria-describedby={errors.email ? "forgot-password-email-error" : undefined}
                                            className="h-12 rounded-lg border-[#e2e5dc] bg-[#fcfcfa] px-3.5 text-[#252823] placeholder:text-[#a0a499] focus-visible:border-[#7a8568] focus-visible:ring-[#7a8568]/15"
                                        />
                                        {errors.email && <p id="forgot-password-email-error" role="alert" className="text-sm text-red-600">{errors.email.message}</p>}
                                    </div>

                                    <Button type="submit" className="mt-6 h-12 w-full rounded-lg bg-[#30392b] text-sm font-medium text-white hover:bg-[#444f3a] focus-visible:ring-[#7a8568]/30" disabled={isPending}>
                                        {isPending ? "Sending..." : "Send reset link"}
                                    </Button>
                                </form>

                                <p className="mt-7 flex flex-wrap justify-center gap-x-1.5 gap-y-1 border-t border-[#eceee7] pt-6 text-center text-xs text-[#73776e]">
                                    <span>Remember your password?</span>
                                    <Link to="/login" className="rounded-sm font-medium text-[#454f39] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]">
                                        Sign in
                                    </Link>
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
