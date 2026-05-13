import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { useRegister } from "../hooks/useRegister";

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
    const { register: registerUser, loading, error } = useRegister();
    const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
        resolver: zodResolver(schema),
    });

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-full max-w-sm space-y-6">
                <h1 className="text-2xl font-bold">Create an account</h1>

                <form onSubmit={handleSubmit((data) => registerUser(data.email, data.password))} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Email</label>
                        <input
                            {...register("email")}
                            type="email"
                            className="w-full border rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
                        />
                        {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium">Password</label>
                        <input
                            {...register("password")}
                            type="password"
                            className="w-full border rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
                        />
                        {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium">Confirm Password</label>
                        <input
                            {...register("confirmPassword")}
                            type="password"
                            className="w-full border rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
                        />
                        {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Creating account..." : "Register"}
                    </Button>
                </form>

                <p className="text-sm text-center text-gray-500">
                    Already have an account?{" "}
                    <Link to="/login" className="underline text-black">
                        Login
                    </Link>
                </p>
            </div>
        </div>
    );
}
