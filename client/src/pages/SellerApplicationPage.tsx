import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useMyApplication, useSubmitApplication } from "../hooks/useSellerApplication";
import { getErrorMessage } from "../lib/errors";

const schema = z.object({
    storeName: z.string().min(1, "Store name is required"),
    reason: z.string().min(10, "Please provide at least 10 characters"),
    portfolioLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    idVerificationUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

const statusLabel: Record<string, string> = {
    PENDING: "Under Review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
};

const statusColor: Record<string, string> = {
    PENDING: "text-yellow-600",
    APPROVED: "text-green-600",
    REJECTED: "text-red-600",
};

export default function SellerApplicationPage() {
    const { data: application, isLoading } = useMyApplication();
    const { mutate: submit, isPending, error } = useSubmitApplication();

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    const onSubmit = (data: FormData) => {
        submit({
            storeName: data.storeName,
            reason: data.reason,
            portfolioLink: data.portfolioLink || undefined,
            idVerificationUrl: data.idVerificationUrl || undefined,
        });
    };

    if (isLoading) return <p className="p-8">Loading...</p>;

    if (application && application.status !== "REJECTED") {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-full max-w-md space-y-4">
                    <h1 className="text-2xl font-bold">Seller Application</h1>
                    <div className="border rounded-lg p-6 space-y-3">
                        <p className="text-sm text-gray-500">Store Name</p>
                        <p className="font-medium">{application.storeName}</p>
                        <p className="text-sm text-gray-500 mt-4">Status</p>
                        <p className={`font-semibold ${statusColor[application.status]}`}>
                            {statusLabel[application.status]}
                        </p>
                        {application.adminNote && (
                            <>
                                <p className="text-sm text-gray-500 mt-4">Admin Note</p>
                                <p className="text-sm">{application.adminNote}</p>
                            </>
                        )}
                        <p className="text-sm text-gray-400 mt-4">
                            Submitted {new Date(application.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-full max-w-md space-y-6">
                <h1 className="text-2xl font-bold">
                    {application?.status === "REJECTED" ? "Reapply to Become a Seller" : "Apply to Become a Seller"}
                </h1>

                {application?.status === "REJECTED" && (
                    <div className="border border-red-200 bg-red-50 rounded-lg p-4 space-y-2">
                        <p className="text-sm font-semibold text-red-700">Your previous application was rejected</p>
                        {application.adminNote && (
                            <div>
                                <p className="text-xs text-gray-500">Admin note</p>
                                <p className="text-sm text-gray-800">{application.adminNote}</p>
                            </div>
                        )}
                        <p className="text-xs text-gray-600">Please address the feedback above before resubmitting.</p>
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-1">
                        <Label>Store Name</Label>
                        <Input {...register("storeName")} placeholder="My Creative Store" />
                        {errors.storeName && <p className="text-sm text-red-500">{errors.storeName.message}</p>}
                    </div>

                    <div className="space-y-1">
                        <Label>Why do you want to sell on PasarPixel?</Label>
                        <Input {...register("reason")} placeholder="Tell us about yourself and your work" />
                        {errors.reason && <p className="text-sm text-red-500">{errors.reason.message}</p>}
                    </div>

                    <div className="space-y-1">
                        <Label>Portfolio Link (optional)</Label>
                        <Input {...register("portfolioLink")} placeholder="https://yourportfolio.com" />
                        {errors.portfolioLink && <p className="text-sm text-red-500">{errors.portfolioLink.message}</p>}
                    </div>

                    <div className="space-y-1">
                        <Label>ID Verification URL (optional)</Label>
                        <Input {...register("idVerificationUrl")} placeholder="https://drive.google.com/..." />
                        {errors.idVerificationUrl && <p className="text-sm text-red-500">{errors.idVerificationUrl.message}</p>}
                    </div>

                    {error && <p className="text-sm text-red-500">{getErrorMessage(error)}</p>}

                    <Button type="submit" className="w-full" disabled={isPending}>
                        {isPending ? "Submitting..." : "Submit Application"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
