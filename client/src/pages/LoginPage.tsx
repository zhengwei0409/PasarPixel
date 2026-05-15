import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useLogin } from "../hooks/useLogin";

const schema = z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
    const { login, loading, error } = useLogin();
    const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
        resolver: zodResolver(schema),
    });

    const handleGoogleLogin = () => {
        window.location.href = "http://localhost:3001/auth/google";
    };

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-full max-w-sm space-y-6">
                <h1 className="text-2xl font-bold">Login</h1>

                <form onSubmit={handleSubmit((data) => login(data.email, data.password))} className="space-y-4">
                    <div className="space-y-1">
                        <Label>Email</Label>
                        <Input {...register("email")} type="email" />
                        {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-1">
                        <Label>Password</Label>
                        <Input {...register("password")} type="password" />
                        {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                    </div>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Logging in..." : "Login"}
                    </Button>

                    <div className="text-right">
                        <Link to="/forgot-password" className="text-sm text-gray-500 underline">
                            Forgot password?
                        </Link>
                    </div>
                </form>

                <div className="flex items-center gap-2 text-sm text-gray-400">
                    <div className="flex-1 border-t" />
                    or
                    <div className="flex-1 border-t" />
                </div>

                <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
                    Login with Google
                </Button>

                <p className="text-sm text-center text-gray-500">
                    Don't have an account?{" "}
                    <Link to="/register" className="underline text-black">
                        Register
                    </Link>
                </p>
            </div>
        </div>
    );
}
