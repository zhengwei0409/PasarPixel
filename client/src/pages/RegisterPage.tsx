import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useRegister } from "../hooks/useRegister";
import { getErrorMessage } from "../lib/errors";

const schema = z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof schema>;

export default function RegisterPage() {
    const { mutate: registerUser, isPending, error } = useRegister();
    const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
        resolver: zodResolver(schema),
    });

    const handleGoogleLogin = () => {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
        window.location.href = `${apiUrl}/auth/google`;
    };

    return (
        <main className="flex min-h-[calc(100dvh-73px)] items-center bg-[#f7f7f2] px-4 py-8 text-[#252823] sm:px-8 sm:py-12 lg:px-12">
            <div className="mx-auto grid w-full max-w-[1200px] items-center gap-16 lg:grid-cols-[1.15fr_1fr] xl:gap-24">
                <section className="hidden min-w-0 flex-col items-start lg:flex" aria-labelledby="register-welcome">
                    <p className="mb-7 text-xs font-medium tracking-[0.2em] text-[#74796c]">A SPACE FOR YOUR NEXT IDEA</p>
                    <h2 id="register-welcome" className="text-[clamp(3rem,5vw,4.5rem)] leading-[1.06] font-medium tracking-[-0.055em]">
                        Your next idea<br />
                        <span className="text-[#7a8568]">starts here.</span>
                    </h2>
                    <p className="mt-6 max-w-[360px] text-base leading-7 text-[#73776e]">
                        Join a community of creators. Discover inspiring digital assets and bring your next idea to life.
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
                        <header className="mb-8 space-y-2">
                            <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.04em]">Create an account</h1>
                            <p className="text-sm leading-relaxed text-[#73776e]">Start creating with PasarPixel.</p>
                        </header>

                        <Button
                            type="button"
                            variant="outline"
                            className="h-12 w-full gap-3 rounded-lg border-[#e2e5dc] bg-white text-sm font-medium text-[#252823] hover:bg-[#f7f7f2]"
                            onClick={handleGoogleLogin}
                            disabled={isPending}
                        >
                            <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
                                <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
                                <path fill="#FBBC05" d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.11-1.31.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.61.38 3.14 1.07 4.51l3.34-2.59Z" />
                                <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.86-2.86A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z" />
                            </svg>
                            Continue with Google
                        </Button>

                        <div className="my-6 flex items-center gap-4 text-xs text-[#85897f]">
                            <div className="h-px flex-1 bg-[#eceee7]" />
                            <span>or sign up with email</span>
                            <div className="h-px flex-1 bg-[#eceee7]" />
                        </div>

                        <form onSubmit={handleSubmit((data) => registerUser({ email: data.email, password: data.password }))} noValidate aria-busy={isPending}>
                            <div className="space-y-2.5">
                                <Label htmlFor="register-email" className="text-sm font-medium text-[#454a40]">Email address</Label>
                                <Input
                                    {...register("email")}
                                    id="register-email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="name@domain.com"
                                    disabled={isPending}
                                    aria-invalid={!!errors.email}
                                    aria-describedby={errors.email ? "register-email-error" : undefined}
                                    className="h-12 rounded-lg border-[#e2e5dc] bg-[#fcfcfa] px-3.5 text-[#252823] placeholder:text-[#a0a499] focus-visible:border-[#7a8568] focus-visible:ring-[#7a8568]/15"
                                />
                                {errors.email && <p id="register-email-error" role="alert" className="text-sm text-red-600">{errors.email.message}</p>}
                            </div>

                            <div className="mt-5 space-y-2.5">
                                <Label htmlFor="register-password" className="text-sm font-medium text-[#454a40]">Password</Label>
                                <Input
                                    {...register("password")}
                                    id="register-password"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="Create a password"
                                    disabled={isPending}
                                    aria-invalid={!!errors.password}
                                    aria-describedby={errors.password ? "register-password-hint register-password-error" : "register-password-hint"}
                                    className="h-12 rounded-lg border-[#e2e5dc] bg-[#fcfcfa] px-3.5 text-[#252823] placeholder:text-[#a0a499] focus-visible:border-[#7a8568] focus-visible:ring-[#7a8568]/15"
                                />
                                <p id="register-password-hint" className="text-xs text-[#73776e]">Use at least 8 characters.</p>
                                {errors.password && <p id="register-password-error" role="alert" className="text-sm text-red-600">{errors.password.message}</p>}
                            </div>

                            <div className="mt-5 space-y-2.5">
                                <Label htmlFor="register-confirm-password" className="text-sm font-medium text-[#454a40]">Confirm password</Label>
                                <Input
                                    {...register("confirmPassword")}
                                    id="register-confirm-password"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="Repeat your password"
                                    disabled={isPending}
                                    aria-invalid={!!errors.confirmPassword}
                                    aria-describedby={errors.confirmPassword ? "register-confirm-password-error" : undefined}
                                    className="h-12 rounded-lg border-[#e2e5dc] bg-[#fcfcfa] px-3.5 text-[#252823] placeholder:text-[#a0a499] focus-visible:border-[#7a8568] focus-visible:ring-[#7a8568]/15"
                                />
                                {errors.confirmPassword && <p id="register-confirm-password-error" role="alert" className="text-sm text-red-600">{errors.confirmPassword.message}</p>}
                            </div>

                            {error && <p role="alert" className="mt-5 text-sm text-red-600">{getErrorMessage(error)}</p>}

                            <Button type="submit" className="mt-6 h-12 w-full rounded-lg bg-[#30392b] text-sm font-medium text-white hover:bg-[#444f3a] focus-visible:ring-[#7a8568]/30" disabled={isPending}>
                                {isPending ? "Creating account..." : "Create account"}
                            </Button>
                        </form>

                        <p className="mt-7 flex flex-wrap justify-center gap-x-1.5 gap-y-1 border-t border-[#eceee7] pt-6 text-center text-xs text-[#73776e]">
                            <span>Already have an account?</span>
                            <Link to="/login" className="rounded-sm font-medium text-[#454f39] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
