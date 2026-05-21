import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useResetPassword } from "../hooks/useResetPassword";
import { getErrorMessage } from "../lib/errors";

const schema = z.object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

type ResetPasswordForm = z.infer<typeof schema>;

export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");

    const { mutate: resetPassword, isPending, isSuccess, error } = useResetPassword();

    const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordForm>({
        resolver: zodResolver(schema),
    });

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-full max-w-sm space-y-4 text-center">
                    <h1 className="text-2xl font-bold">Invalid Link</h1>
                    <p className="text-sm text-gray-500">This reset link is missing a token.</p>
                    <Link to="/forgot-password" className="text-sm underline text-black">
                        Request a new link
                    </Link>
                </div>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-full max-w-sm space-y-4 text-center">
                    <h1 className="text-2xl font-bold">Password Reset!</h1>
                    <p className="text-sm text-gray-500">Your password has been updated successfully.</p>
                    <Link to="/login" className="text-sm underline text-black">
                        Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-full max-w-sm space-y-6">
                <h1 className="text-2xl font-bold">Reset Password</h1>

                <form onSubmit={handleSubmit((data) => resetPassword({ token, newPassword: data.newPassword }))} className="space-y-4">
                    <div className="space-y-1">
                        <Label>New Password</Label>
                        <Input {...register("newPassword")} type="password" />
                        {errors.newPassword && <p className="text-sm text-red-500">{errors.newPassword.message}</p>}
                    </div>

                    <div className="space-y-1">
                        <Label>Confirm Password</Label>
                        <Input {...register("confirmPassword")} type="password" />
                        {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
                    </div>

                    {error && <p className="text-sm text-red-500">{getErrorMessage(error, "Something went wrong. Please try again.")}</p>}

                    <Button type="submit" className="w-full" disabled={isPending}>
                        {isPending ? "Resetting..." : "Reset Password"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
