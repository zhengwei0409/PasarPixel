import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useProfile } from "../hooks/useProfile";
import { useUpdateProfile } from "../hooks/useUpdateProfile";
import { useUploadAvatar, useDeleteAvatar } from "../hooks/useAvatar";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

interface ProfileForm {
    name: string;
    bio: string;
    phone: string;
    country: string;
    billingAddress: string;
}

export default function ProfilePage() {
    const { data: profile, isLoading, isError } = useProfile();
    const { mutate: saveProfile, isPending, isSuccess, error: saveError } = useUpdateProfile();
    const uploadAvatar = useUploadAvatar();
    const removeAvatar = useDeleteAvatar();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { register, handleSubmit, reset } = useForm<ProfileForm>();

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            alert("Please select an image file.");
            return;
        }
        if (file.size > MAX_AVATAR_SIZE) {
            alert("Image must be smaller than 5 MB.");
            return;
        }
        uploadAvatar.mutate(file);
    };

    useEffect(() => {
        if (!profile) return;
        reset({
            name: profile.name ?? "",
            bio: profile.bio ?? "",
            phone: profile.phone ?? "",
            country: profile.country ?? "",
            billingAddress: profile.billingAddress ?? "",
        });
    }, [profile, reset]);

    const onSubmit = (data: ProfileForm) => {
        saveProfile({
            name: data.name,
            bio: data.bio,
            phone: data.phone,
            country: data.country,
            billingAddress: data.billingAddress,
        });
    };

    if (isLoading) return <p className="p-8">Loading...</p>;
    if (isError) return <p className="p-8 text-red-500">Failed to load profile.</p>;

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-full max-w-md space-y-6">
                <h1 className="text-2xl font-bold">My Profile</h1>

                <div className="flex items-center gap-4">
                    <Avatar size="lg" className="size-20!">
                        {profile?.avatarUrl && (
                            <AvatarImage src={profile.avatarUrl} alt={profile?.name ?? "Avatar"} />
                        )}
                        <AvatarFallback className="text-2xl">
                            {(profile?.name ?? "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarChange}
                        />
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadAvatar.isPending || removeAvatar.isPending}
                            >
                                {uploadAvatar.isPending ? "Uploading..." : "Upload picture"}
                            </Button>
                            {profile?.avatarUrl && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeAvatar.mutate()}
                                    disabled={uploadAvatar.isPending || removeAvatar.isPending}
                                >
                                    Remove
                                </Button>
                            )}
                        </div>
                        {uploadAvatar.error && (
                            <p className="text-xs text-red-500">Upload failed.</p>
                        )}
                        {removeAvatar.error && (
                            <p className="text-xs text-red-500">Remove failed.</p>
                        )}
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-1">
                        <Label>Name</Label>
                        <Input {...register("name")} />
                    </div>

                    <div className="space-y-1">
                        <Label>Bio</Label>
                        <Input {...register("bio")} placeholder="Tell us about yourself" />
                    </div>

                    <div className="space-y-1">
                        <Label>Phone</Label>
                        <Input {...register("phone")} placeholder="+60123456789" />
                    </div>

                    <div className="space-y-1">
                        <Label>Country / Region</Label>
                        <Input {...register("country")} placeholder="Malaysia" />
                    </div>

                    <div className="space-y-1">
                        <Label>Billing address</Label>
                        <Input
                            {...register("billingAddress")}
                            placeholder="Street, city, postcode"
                        />
                    </div>

                    {isSuccess && <p className="text-sm text-green-600">Profile saved successfully.</p>}
                    {saveError && <p className="text-sm text-red-500">Failed to save profile.</p>}

                    <Button type="submit" className="w-full" disabled={isPending}>
                        {isPending ? "Saving..." : "Save Profile"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
