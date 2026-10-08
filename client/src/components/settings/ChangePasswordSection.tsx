import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, getPasswordStatus } from "@/services/authService";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "Password must be at least 8 characters")
        .refine((value) => new TextEncoder().encode(value).length <= 72, "Password must be at most 72 bytes"),
    confirmPassword: z.string(),
}).refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

type PasswordForm = z.infer<typeof schema>;

export default function ChangePasswordSection() {
    const { user } = useAuth();
    const status = useQuery({
        queryKey: ["password", "status", user?.sub],
        queryFn: getPasswordStatus,
        enabled: Boolean(user),
    });
    const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordForm>({
        resolver: zodResolver(schema),
    });
    const change = useMutation({
        mutationFn: changePassword,
        onSuccess: () => reset(),
    });

    if (status.isPending) {
        return <p role="status" className="text-sm text-[#73776e]">Checking your password settings…</p>;
    }
    if (status.isError) {
        return (
            <div role="alert" className="flex flex-wrap items-center gap-4 rounded-xl border border-[#e7e9e1] bg-white p-6">
                <p className="text-sm text-red-700">Unable to load your password settings.</p>
                <Button variant="outline" onClick={() => void status.refetch()}>Try again</Button>
            </div>
        );
    }
    if (!status.data.hasPassword) return null;

    return (
        <section aria-labelledby="password-heading" className="rounded-xl border border-[#e7e9e1] bg-white p-6 shadow-[0_2px_4px_-3px_rgba(37,40,35,0.15)] sm:p-9">
            <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e9ecdf] text-[#657152]">
                    <KeyRound className="size-5" aria-hidden="true" />
                </div>
                <div>
                    <p className="mb-2 text-[10px] font-medium tracking-[0.18em] text-[#73776e] uppercase">Security</p>
                    <h2 id="password-heading" className="text-xl font-semibold tracking-[-0.03em]">Change password</h2>
                    <p className="mt-2 text-sm leading-6 text-[#73776e]">Update the password you use to sign in. Choose at least 8 characters.</p>
                </div>
            </div>
            <form
                className="mt-8 space-y-5 border-t border-[#e7e9e1] pt-6"
                onChange={() => { if (!change.isPending) change.reset(); }}
                onSubmit={handleSubmit(({ currentPassword, newPassword }) => change.mutate({ currentPassword, newPassword }))}
            >
                {([
                    ["currentPassword", "Current password", "current-password"],
                    ["newPassword", "New password", "new-password"],
                    ["confirmPassword", "Confirm new password", "new-password"],
                ] as const).map(([name, label, autoComplete]) => (
                    <div key={name} className="max-w-md space-y-2">
                        <Label htmlFor={`change-${name}`}>{label}</Label>
                        <Input
                            {...register(name)}
                            id={`change-${name}`}
                            type="password"
                            autoComplete={autoComplete}
                            disabled={change.isPending}
                            aria-invalid={Boolean(errors[name])}
                            aria-describedby={errors[name] ? `change-${name}-error` : undefined}
                            className="h-11 rounded-lg bg-[#fafbf7] shadow-none focus-visible:ring-[#7a8568]/20"
                        />
                        {errors[name] && <p id={`change-${name}-error`} role="alert" className="text-sm text-red-700">{errors[name]?.message}</p>}
                    </div>
                ))}
                {change.isError && <p role="alert" className="text-sm text-red-700">{getErrorMessage(change.error, "Unable to change your password. Please try again.")}</p>}
                {change.isSuccess && <p role="status" className="text-sm text-[#657152]">Your password has been changed successfully.</p>}
                <Button type="submit" disabled={change.isPending} className="h-11 bg-[#30392b] px-5 text-white hover:bg-[#444f3a]">
                    {change.isPending ? "Saving…" : "Change password"}
                </Button>
            </form>
        </section>
    );
}
