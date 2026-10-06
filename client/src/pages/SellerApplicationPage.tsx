import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Check, Clock3, FileCheck2, Store, Upload } from "lucide-react";
import FloatingShapes from "@/components/home/FloatingShapes";
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
    PENDING: "Under review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    REVOKED: "Seller access revoked",
};

const fieldClass = "h-12 rounded-lg border-[#dfe4d6] bg-[#fcfcfa] px-3.5 text-[#252823] shadow-none placeholder:text-[#a0a499] focus-visible:border-[#7a8568] focus-visible:ring-[#7a8568]/15";
const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]";

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id} className="text-sm font-medium text-[#454a40]">{label}</Label>
            {children}
            {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
        </div>
    );
}

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

        setIdFileError(null);
        try {
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
        } catch (uploadError) {
            setIdFileError(getErrorMessage(uploadError));
        }
    };

    const busy = isPending || isUploading;
    const hasApplication = application && application.status !== "REJECTED";
    const rejected = application?.status === "REJECTED";

    return (
        <main className="relative isolate min-h-[calc(100dvh-73px)] bg-[#f7f7f2] text-[#252823]">
            <FloatingShapes />
            <div className="relative z-10 mx-auto max-w-[1104px] px-4 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
                <Link to="/" className={`inline-flex items-center gap-2 rounded-sm text-xs font-medium text-[#73776e] hover:text-[#30392b] ${focusClass}`}>
                    <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to home
                </Link>

                <div className="mt-9 grid items-start gap-10 lg:grid-cols-[0.85fr_1.4fr] lg:gap-16">
                    <aside className="lg:sticky lg:top-28">
                        <p className="text-[10px] font-medium tracking-[0.2em] text-[#74796c]">CREATE. SHARE. GROW.</p>
                        <h1 className="mt-4 text-[clamp(2.25rem,4vw,3.25rem)] leading-[1.1] font-semibold tracking-[-0.05em]">
                            Your work.<br /><span className="font-normal text-[#7a8568] italic">A new audience.</span>
                        </h1>
                        <p className="mt-5 max-w-sm text-sm leading-7 text-[#73776e]">
                            Bring your creative assets to PasarPixel. Tell us about your store and apply to become a seller.
                        </p>
                        <ol className="mt-8 max-w-sm space-y-5 border-t border-[#e7e9e1] pt-7">
                            {[
                                { icon: Store, title: "Introduce your store", description: "Share what you create and a little about your work." },
                                { icon: FileCheck2, title: "Verify your identity", description: "Provide your details and a clear copy of your ID." },
                                { icon: Clock3, title: "Submit for review", description: "Return here to check your application status." },
                            ].map(({ icon: Icon, title, description }) => (
                                <li key={title} className="flex gap-3.5">
                                    <Icon className="mt-0.5 size-[18px] shrink-0 text-[#7a8568]" aria-hidden="true" />
                                    <div>
                                        <p className="text-sm font-medium text-[#454a40]">{title}</p>
                                        <p className="mt-1 text-xs leading-5 text-[#85897f]">{description}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </aside>

                    <section aria-labelledby="application-heading" className="min-w-0 rounded-2xl border border-[#e7e9e1] bg-white p-6 shadow-[0_12px_40px_-24px_rgba(37,40,35,0.15)] sm:p-8">
                        <header className="border-b border-[#e7e9e1] pb-6">
                            <h2 id="application-heading" className="text-2xl font-semibold tracking-[-0.035em]">
                                {hasApplication ? "Your application" : rejected ? "Apply again" : "Seller application"}
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-[#73776e]">
                                {hasApplication ? "Track your progress and review feedback here." : "A few details to get your store started."}
                            </p>
                        </header>

                        {isLoading ? (
                            <div role="status" className="flex items-center gap-3 py-12 text-sm text-[#73776e]">
                                <Clock3 className="size-4 text-[#7a8568]" aria-hidden="true" /> Loading your application…
                            </div>
                        ) : hasApplication ? (
                            <div className="pt-6">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-xs text-[#73776e]">Application status</p>
                                    <span className="inline-flex items-center gap-2 rounded-full border border-[#dfe4d6] bg-[#eef0e7] px-3 py-1.5 text-xs font-medium text-[#555e49]">
                                        {application.status === "APPROVED" ? <Check className="size-3.5" aria-hidden="true" /> : <Clock3 className="size-3.5" aria-hidden="true" />}
                                        {statusLabel[application.status] ?? application.status}
                                    </span>
                                </div>
                                <p className="mt-5 text-sm leading-6 text-[#73776e]">
                                    {application.status === "APPROVED" ? "Your application has been approved. Sign in again to access your seller dashboard." : application.status === "REVOKED" ? "Your seller access has been revoked. Review the feedback below for more information." : "Your application is with our team. Check back here for updates."}
                                </p>
                                <dl className="mt-6 space-y-5 border-t border-[#e7e9e1] pt-6">
                                    <div><dt className="text-xs text-[#85897f]">Store name</dt><dd className="mt-1.5 break-words text-base font-medium">{application.storeName}</dd></div>
                                    <div><dt className="text-xs text-[#85897f]">Submitted</dt><dd className="mt-1.5 text-sm">{new Date(application.createdAt).toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "long", year: "numeric" })}</dd></div>
                                </dl>
                                {application.adminNote && (
                                    <div className="mt-6 rounded-lg border border-[#dfe4d6] bg-[#f7f7f2] p-4">
                                        <h3 className="text-xs font-medium text-[#555e49]">Review feedback</h3>
                                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#73776e]">{application.adminNote}</p>
                                    </div>
                                )}
                                <Button asChild variant="outline" className="mt-7 h-11 rounded-lg border-[#dfe4d6] text-[#555e49] hover:bg-[#eef0e7]">
                                    <Link to="/marketplace">Explore the marketplace <ArrowUpRight className="size-4" aria-hidden="true" /></Link>
                                </Button>
                            </div>
                        ) : (
                            <>
                                {rejected && (
                                    <div role="status" className="mt-6 rounded-lg border border-[#dfe4d6] bg-[#f2f4ed] p-4">
                                        <p className="text-sm font-medium text-[#555e49]">Your previous application wasn’t approved</p>
                                        {application.adminNote && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#73776e]">{application.adminNote}</p>}
                                        <p className="mt-2 text-xs leading-5 text-[#73776e]">Please address the feedback before submitting again.</p>
                                    </div>
                                )}
                                <form onSubmit={handleSubmit(onSubmit)} noValidate aria-busy={busy} className="pt-6">
                                    <fieldset disabled={busy} className="space-y-5">
                                        <legend className="mb-5 text-[11px] font-medium tracking-[0.14em] text-[#657152]">01 / YOUR STORE</legend>
                                        <Field id="storeName" label="Store name" error={errors.storeName?.message}>
                                            <Input id="storeName" {...register("storeName")} placeholder="My Creative Store" className={fieldClass} aria-invalid={!!errors.storeName} aria-describedby={errors.storeName ? "storeName-error" : undefined} />
                                        </Field>
                                        <Field id="reason" label="Tell us about your work" error={errors.reason?.message}>
                                            <textarea id="reason" {...register("reason")} rows={4} placeholder="What do you create, and why would you like to sell on PasarPixel?" className={`${fieldClass} h-auto w-full resize-y border py-3 text-sm outline-none focus-visible:ring-3 disabled:opacity-50`} aria-invalid={!!errors.reason} aria-describedby={errors.reason ? "reason-error" : undefined} />
                                        </Field>
                                        <Field id="portfolioLink" label="Portfolio link (optional)" error={errors.portfolioLink?.message}>
                                            <Input id="portfolioLink" type="url" {...register("portfolioLink")} placeholder="https://yourportfolio.com" className={fieldClass} aria-invalid={!!errors.portfolioLink} aria-describedby={errors.portfolioLink ? "portfolioLink-error" : undefined} />
                                        </Field>
                                    </fieldset>

                                    <fieldset disabled={busy} className="mt-8 border-t border-[#e7e9e1] pt-6">
                                        <legend className="mb-5 text-[11px] font-medium tracking-[0.14em] text-[#657152]">02 / IDENTITY DETAILS</legend>
                                        <div className="grid gap-5 sm:grid-cols-2">
                                            <Field id="fullName" label="Full legal name" error={errors.fullName?.message}>
                                                <Input id="fullName" autoComplete="name" {...register("fullName")} placeholder="As shown on your ID" className={fieldClass} aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? "fullName-error" : undefined} />
                                            </Field>
                                            <Field id="dateOfBirth" label="Date of birth" error={errors.dateOfBirth?.message}>
                                                <Input id="dateOfBirth" type="date" autoComplete="bday" {...register("dateOfBirth")} className={fieldClass} aria-invalid={!!errors.dateOfBirth} aria-describedby={errors.dateOfBirth ? "dateOfBirth-error" : undefined} />
                                            </Field>
                                            <div className="sm:col-span-2">
                                                <Field id="address" label="Residential address" error={errors.address?.message}>
                                                    <Input id="address" autoComplete="street-address" {...register("address")} placeholder="Your residential address" className={fieldClass} aria-invalid={!!errors.address} aria-describedby={errors.address ? "address-error" : undefined} />
                                                </Field>
                                            </div>
                                            <div className="sm:col-span-2">
                                                <Field id="idDocument" label="ID document" error={idFileError ?? undefined}>
                                                    <div className="rounded-lg border border-dashed border-[#c5cfb5] bg-[#f7f7f2] p-4">
                                                        <div className="mb-3 flex items-start gap-3">
                                                            <Upload className="mt-0.5 size-4 shrink-0 text-[#7a8568]" aria-hidden="true" />
                                                            <p id="idDocument-help" className="text-xs leading-5 text-[#73776e]">A clear photo or scan of your ID.<br />JPG, PNG, or PDF · Up to 10 MB</p>
                                                        </div>
                                                        <Input id="idDocument" type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleIdFileChange} aria-invalid={!!idFileError} aria-describedby={`idDocument-help${idFileError ? " idDocument-error" : ""}`} className="h-auto cursor-pointer border-0 bg-transparent p-0 text-xs text-[#73776e] shadow-none file:mr-3 file:h-9 file:cursor-pointer file:rounded-md file:bg-[#e3e8d8] file:px-3 file:text-xs file:text-[#30392b] focus-visible:ring-[#7a8568]/20" />
                                                        {idFile && <p role="status" className="mt-3 flex items-start gap-2 break-all text-xs text-[#657152]"><Check className="size-3.5 shrink-0" aria-hidden="true" />{idFile.name}</p>}
                                                    </div>
                                                </Field>
                                            </div>
                                        </div>
                                    </fieldset>

                                    {error && <p role="alert" className="mt-5 text-sm text-destructive">{getErrorMessage(error)}</p>}
                                    <div className="mt-8 border-t border-[#e7e9e1] pt-6">
                                        <Button type="submit" className="h-12 w-full rounded-lg bg-[#30392b] text-sm font-medium text-white hover:bg-[#444f3a] focus-visible:ring-[#7a8568]/30" disabled={busy}>
                                            {isUploading ? "Uploading ID…" : isPending ? "Submitting…" : "Submit application"}
                                            {!busy && <ArrowUpRight className="size-4" aria-hidden="true" />}
                                        </Button>
                                        <p className="mt-3 text-center text-xs leading-5 text-[#85897f]">Your application will be reviewed before seller access is granted.</p>
                                    </div>
                                </form>
                            </>
                        )}
                    </section>
                </div>
            </div>
            <footer className="relative z-10 border-t border-[#e7e9e1] px-4 py-7 sm:px-8">
                <p className="mx-auto max-w-[1008px] text-xs text-[#85897f]">PasarPixel <span className="mx-2 text-[#c5cfb5]">/</span> Creative assets. New possibilities.</p>
            </footer>
        </main>
    );
}
