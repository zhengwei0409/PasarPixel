import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useMyApplication, useSubmitApplication, useUploadIdDocument } from "../hooks/useSellerApplication";
import { getErrorMessage } from "../lib/errors";

const ALLOWED_ID_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_ID_SIZE = 10 * 1024 * 1024;

const schema = z.object({
    storeName: z.string().min(1, "Store name is required"),
    reason: z.string().min(10, "Please provide at least 10 characters"),
    portfolioLink: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    fullName: z.string().min(1, "Full legal name is required"),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    address: z.string().min(1, "Address is required"),
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
    const { mutateAsync: uploadIdDocument, isPending: isUploading } = useUploadIdDocument();

    const [idFile, setIdFile] = useState<File | null>(null);
    const [idFileError, setIdFileError] = useState<string | null>(null);

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    const handleIdFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setIdFileError(null);
        if (file && !ALLOWED_ID_TYPES.includes(file.type)) {
            setIdFileError("ID document must be a JPG, PNG, or PDF");
            setIdFile(null);
            return;
        }
        if (file && file.size > MAX_ID_SIZE) {
            setIdFileError("ID document must be 10 MB or smaller");
            setIdFile(null);
            return;
        }
        setIdFile(file);
    };

    const onSubmit = async (data: FormData) => {
        if (!idFile) {
            setIdFileError("Please upload your ID document");
            return;
        }

        const idDocumentKey = await uploadIdDocument(idFile);

        submit({
            storeName: data.storeName,
            reason: data.reason,
            portfolioLink: data.portfolioLink || undefined,
            fullName: data.fullName,
            dateOfBirth: data.dateOfBirth,
            address: data.address,
            idDocumentKey,
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
                        <Label>Full Legal Name</Label>
                        <Input {...register("fullName")} placeholder="As shown on your ID" />
                        {errors.fullName && <p className="text-sm text-red-500">{errors.fullName.message}</p>}
                    </div>

                    <div className="space-y-1">
                        <Label>Date of Birth</Label>
                        <Input type="date" {...register("dateOfBirth")} />
                        {errors.dateOfBirth && <p className="text-sm text-red-500">{errors.dateOfBirth.message}</p>}
                    </div>

                    <div className="space-y-1">
                        <Label>Address</Label>
                        <Input {...register("address")} placeholder="Your residential address" />
                        {errors.address && <p className="text-sm text-red-500">{errors.address.message}</p>}
                    </div>

                    <div className="space-y-1">
                        <Label>ID Document (JPG, PNG, or PDF)</Label>
                        <Input
                            type="file"
                            accept="image/jpeg,image/png,application/pdf"
                            onChange={handleIdFileChange}
                        />
                        <p className="text-xs text-gray-500">Upload a clear photo or scan of your ID. Max 10 MB.</p>
                        {idFile && <p className="text-sm text-green-600">Selected: {idFile.name}</p>}
                        {idFileError && <p className="text-sm text-red-500">{idFileError}</p>}
                    </div>

                    {error && <p className="text-sm text-red-500">{getErrorMessage(error)}</p>}

                    <Button type="submit" className="w-full" disabled={isPending || isUploading}>
                        {isUploading ? "Uploading ID..." : isPending ? "Submitting..." : "Submit Application"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
