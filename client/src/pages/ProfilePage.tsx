import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { Check, Loader2, Pencil } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useProfile } from "../hooks/useProfile";
import { useUpdateProfile } from "../hooks/useUpdateProfile";
import { useUploadAvatar, useDeleteAvatar } from "../hooks/useAvatar";
import { useAuth } from "../hooks/useAuth";
import { useTwoFactorStatus } from "../hooks/useTwoFactor";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import FloatingShapes from "@/components/home/FloatingShapes";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const fieldLabelClass = "text-[10px] font-medium uppercase tracking-[0.18em] text-[#73776e]";
const fieldInputClass = "h-11 rounded-lg border-[#dfe4d6] bg-[#fafbf7] px-3 shadow-none focus-visible:border-[#7a8568] focus-visible:ring-[#7a8568]/20";

interface ProfileForm {
    name: string;
    bio: string;
    phone: string;
    country: string;
    billingAddress: string;
}

export default function ProfilePage() {
    const { data: profile, isLoading, isError, refetch } = useProfile();
    const updateProfile = useUpdateProfile();
    const uploadAvatar = useUploadAvatar();
    const removeAvatar = useDeleteAvatar();
    const { user } = useAuth();
    const twoFactor = useTwoFactorStatus();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [avatarError, setAvatarError] = useState("");
    const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileForm>();

    // Avatar updates should not overwrite unsaved text changes.
    const name = profile?.name ?? "";
    const bio = profile?.bio ?? "";
    const phone = profile?.phone ?? "";
    const country = profile?.country ?? "";
    const billingAddress = profile?.billingAddress ?? "";
    useEffect(() => {
        reset({ name, bio, phone, country, billingAddress });
    }, [name, bio, phone, country, billingAddress, reset]);

    const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setAvatarError("");
        uploadAvatar.reset();
        removeAvatar.reset();
        if (!file.type.startsWith("image/")) {
            setAvatarError("Please select an image file.");
            return;
        }
        if (file.size > MAX_AVATAR_SIZE) {
            setAvatarError("Image must be smaller than 5 MB.");
            return;
        }
        uploadAvatar.mutate(file);
    };

    const onSubmit = (data: ProfileForm) => {
        updateProfile.mutate({
            name: data.name.trim(),
            bio: data.bio,
            phone: data.phone,
            country: data.country,
            billingAddress: data.billingAddress,
        }, { onSuccess: () => setIsEditing(false) });
    };

    const avatarBusy = uploadAvatar.isPending || removeAvatar.isPending;
    const role = user?.roles.includes("ADMIN") ? "Admin" : user?.roles.includes("SELLER") ? "Seller" : "Buyer";
    const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";

    return (
        <main className="profile-theme relative isolate min-h-[calc(100dvh-73px)] bg-[#f7f7f2] text-[#252823]">
            <FloatingShapes />
            <div className="relative z-10 mx-auto max-w-[1104px] px-4 py-10 sm:px-8 sm:py-16 lg:px-12">
                {isLoading ? (
                    <div role="status" className="flex min-h-80 items-center justify-center gap-3 text-sm text-[#73776e]">
                        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading your profile…
                    </div>
                ) : isError || !profile ? (
                    <div role="alert" className="rounded-xl border border-[#dfe4d6] bg-white p-8 text-center">
                        <h1 className="text-xl font-semibold">Unable to load your profile</h1>
                        <p className="mt-2 text-sm text-[#73776e]">Please try again in a moment.</p>
                        <Button onClick={() => void refetch()} className="mt-5 h-10 px-5 hover:bg-[#444f3a]">Try again</Button>
                    </div>
                ) : (
                    <>
                        <p className="mb-7 text-[10px] font-medium tracking-[0.22em] text-[#73776e]">YOUR PERSONAL SPACE</p>
                        <header className="flex flex-col items-start gap-7 sm:flex-row sm:items-center sm:gap-9">
                            <div className="shrink-0">
                                <div className="relative w-fit">
                                    <Avatar className="size-32! overflow-hidden rounded-2xl bg-[#e3e8d8] ring-4 ring-white after:rounded-2xl sm:size-40!">
                                        {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={`${name || "Your"} profile picture`} className="rounded-2xl" />}
                                        <AvatarFallback className="rounded-2xl bg-[#e3e8d8] text-4xl font-medium tracking-[-0.04em] text-[#657152] sm:text-5xl">{initials}</AvatarFallback>
                                    </Avatar>
                                    <Button type="button" size="icon" aria-label="Change profile picture" title="Change profile picture" className="absolute -right-2 -bottom-2 size-10 rounded-xl border-4 border-[#f7f7f2] hover:bg-[#444f3a]" onClick={() => fileInputRef.current?.click()} disabled={avatarBusy}>
                                        {avatarBusy ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Pencil className="size-3.5" aria-hidden="true" />}
                                    </Button>
                                </div>
                                <input ref={fileInputRef} type="file" accept="image/*" aria-label="Upload profile picture" className="hidden" onChange={handleAvatarChange} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                                    <h1 className="max-w-full wrap-anywhere text-2xl leading-tight font-semibold tracking-[-0.04em] sm:text-3xl">{name || "My profile"}</h1>
                                    <span className="inline-flex items-center gap-2 rounded-full border border-[#d3dbc5] bg-[#e9ecdf] px-3 py-1.5 text-[10px] font-medium tracking-[0.12em] text-[#555e49] uppercase">
                                        <span className="size-1.5 rounded-full bg-[#7a8568]" aria-hidden="true" /> {role} account
                                    </span>
                                </div>
                                <p className="mt-3 max-w-xl whitespace-pre-line break-words text-sm leading-6 text-[#73776e]">{bio || "A little about you, all in one place."}</p>
                                <div className="mt-6 flex flex-wrap gap-3">
                                    <Button type="button" onClick={() => { updateProfile.reset(); setIsEditing(true); }} disabled={isEditing} className="h-11 gap-2 rounded-lg px-5 hover:bg-[#444f3a]">
                                        <Pencil className="size-3.5" aria-hidden="true" /> Edit profile
                                    </Button>
                                </div>
                            </div>
                        </header>

                        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#73776e]">
                            <span>JPG, PNG or other images. Up to 5 MB.</span>
                            {profile.avatarUrl && <button type="button" className="cursor-pointer rounded-sm underline underline-offset-4 hover:text-[#30392b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568] disabled:cursor-default disabled:opacity-50" disabled={avatarBusy} onClick={() => { setAvatarError(""); uploadAvatar.reset(); removeAvatar.mutate(); }}>{removeAvatar.isPending ? "Removing…" : "Remove picture"}</button>}
                        </div>
                        {(avatarError || uploadAvatar.error || removeAvatar.error) && <p role="alert" className="mt-3 text-sm text-red-700">{avatarError || (uploadAvatar.error ? "Upload failed. Please try again." : "Could not remove your picture. Please try again.")}</p>}

                        <section aria-labelledby="account-details-heading" className="mt-10 rounded-xl border border-[#e7e9e1] bg-white p-6 shadow-[0_2px_4px_-3px_rgba(37,40,35,0.15)] sm:mt-12 sm:p-9">
                            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <h2 id="account-details-heading" className="text-xl font-semibold tracking-[-0.03em]">{isEditing ? "Edit your profile" : "Account details"}</h2>
                                    <p className="mt-1.5 text-sm text-[#73776e]">{isEditing ? "Keep your personal information up to date." : "Your personal information and account preferences."}</p>
                                </div>
                            </div>
                            {isEditing ? (
                                <form onSubmit={handleSubmit(onSubmit)}>
                                    <fieldset disabled={updateProfile.isPending} className="grid gap-x-12 gap-y-6 sm:grid-cols-2">
                                        <div className="space-y-2.5">
                                            <Label htmlFor="profile-name" className={fieldLabelClass}>Display name</Label>
                                            <Input id="profile-name" autoFocus autoComplete="nickname" placeholder="Your display name" className={fieldInputClass} aria-invalid={!!errors.name} aria-describedby={errors.name ? "profile-name-help profile-name-error" : "profile-name-help"} {...register("name", { validate: (value) => value.trim().length > 0 || "Please enter your display name." })} />
                                            <p id="profile-name-help" className="text-xs leading-5 text-[#73776e]">Choose the name shown on your profile.</p>
                                            {errors.name && <p id="profile-name-error" role="alert" className="text-xs text-red-700">{errors.name.message}</p>}
                                        </div>
                                        <div className="space-y-2.5">
                                            <Label htmlFor="profile-email" className={fieldLabelClass}>Email address</Label>
                                            <Input id="profile-email" type="email" readOnly value={user?.email ?? ""} className={`${fieldInputClass} text-[#73776e]`} aria-describedby="profile-email-help" />
                                            <p id="profile-email-help" className="text-xs leading-5 text-[#73776e]">Your login email stays the same when you change your display name.</p>
                                        </div>
                                        <div className="space-y-2.5">
                                            <Label htmlFor="profile-phone" className={fieldLabelClass}>Phone number</Label>
                                            <Input id="profile-phone" type="tel" autoComplete="tel" className={fieldInputClass} placeholder="+60123456789" {...register("phone")} />
                                        </div>
                                        <div className="space-y-2.5">
                                            <Label htmlFor="profile-country" className={fieldLabelClass}>Country / region</Label>
                                            <Input id="profile-country" autoComplete="country-name" className={fieldInputClass} placeholder="Malaysia" {...register("country")} />
                                        </div>
                                        <div className="space-y-2.5">
                                            <Label htmlFor="profile-address" className={fieldLabelClass}>Billing address</Label>
                                            <Input id="profile-address" autoComplete="street-address" className={fieldInputClass} placeholder="Street, city, postcode" {...register("billingAddress")} />
                                        </div>
                                        <div className="space-y-2.5 sm:col-span-2">
                                            <Label htmlFor="profile-bio" className={fieldLabelClass}>About you</Label>
                                            <textarea id="profile-bio" rows={3} className="w-full resize-y rounded-lg border border-[#dfe4d6] bg-[#fafbf7] px-3 py-3 text-sm outline-none placeholder:text-[#85897f] focus-visible:border-[#7a8568] focus-visible:ring-3 focus-visible:ring-[#7a8568]/20 disabled:opacity-50" placeholder="Tell us a little about yourself" {...register("bio")} />
                                        </div>
                                    </fieldset>
                                    {updateProfile.error && <p role="alert" className="mt-5 text-sm text-red-700">Failed to save your profile. Please try again.</p>}
                                    <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-[#e7e9e1] pt-6">
                                        <Button type="button" variant="outline" disabled={updateProfile.isPending} className="h-11 bg-white px-5" onClick={() => { reset({ name, bio, phone, country, billingAddress }); updateProfile.reset(); setIsEditing(false); }}>Cancel</Button>
                                        <Button type="submit" disabled={updateProfile.isPending} className="h-11 px-5 hover:bg-[#444f3a]">{updateProfile.isPending ? "Saving…" : "Save changes"}</Button>
                                    </div>
                                </form>
                            ) : (
                                <dl className="grid gap-x-12 gap-y-8 sm:grid-cols-2 sm:gap-y-10">
                                    {[
                                        { label: "Email address", value: user?.email },
                                        { label: "Phone number", value: phone },
                                        { label: "Account role", value: role },
                                        { label: "Country / region", value: country },
                                        { label: "Billing address", value: billingAddress },
                                    ].map(({ label, value }) => (
                                        <div key={label}>
                                            <dt className={fieldLabelClass}>{label}</dt>
                                            <dd className={`mt-2.5 whitespace-pre-line break-words text-sm leading-6 ${value ? "text-[#252823]" : "text-[#85897f]"}`}>{value || "Not provided"}</dd>
                                        </div>
                                    ))}
                                    <div>
                                        <dt className={fieldLabelClass}>Two-factor authentication</dt>
                                        <dd className="mt-2.5 flex items-center gap-2 text-sm leading-6">
                                            {twoFactor.isLoading ? <span className="text-[#85897f]">Checking…</span> : twoFactor.isError ? <span className="text-[#85897f]">Unavailable</span> : twoFactor.data?.enabled ? <span className="inline-flex items-center gap-2 text-[#657152]"><Check className="size-4" aria-hidden="true" /> Enabled</span> : <><span className="text-[#73776e]">Not enabled</span><Link to="/settings" className="rounded-sm text-xs text-[#657152] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]">Set up</Link></>}
                                        </dd>
                                    </div>
                                </dl>
                            )}
                        </section>
                        {updateProfile.isSuccess && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-[#657152]"><Check className="size-4" aria-hidden="true" /> Profile saved successfully.</p>}
                    </>
                )}
            </div>
        </main>
    );
}
