import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import authApi from "../lib/authApi";

const schema = z.object({
    email: z.string().email("Invalid email"),
});

type ForgotPasswordForm = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordForm>({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data: ForgotPasswordForm) => {
        setLoading(true);
        try {
            await authApi.post("/auth/forgot-password", { email: data.email });
        } finally {
            setLoading(false);
            setSubmitted(true);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-full max-w-sm space-y-4 text-center">
                    <h1 className="text-2xl font-bold">Check your email</h1>
                    <p className="text-sm text-gray-500">
                        If that email is registered, you'll receive a reset link shortly.
                    </p>
                    <Link to="/login" className="text-sm underline text-black">
                        Back to Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-full max-w-sm space-y-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold">Forgot Password</h1>
                    <p className="text-sm text-gray-500">Enter your email and we'll send you a reset link.</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-1">
                        <Label>Email</Label>
                        <Input {...register("email")} type="email" />
                        {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Sending..." : "Send Reset Link"}
                    </Button>
                </form>

                <p className="text-sm text-center text-gray-500">
                    Remember your password?{" "}
                    <Link to="/login" className="underline text-black">
                        Login
                    </Link>
                </p>
            </div>
        </div>
    );
}
