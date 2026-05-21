import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useProfile } from "../hooks/useProfile";
import { useUpdateProfile } from "../hooks/useUpdateProfile";

interface ProfileForm {
    name: string;
    bio: string;
    phone: string;
    github: string;
    twitter: string;
    linkedin: string;
}

export default function ProfilePage() {
    const { data: profile, isLoading, isError } = useProfile();
    const { mutate: saveProfile, isPending, isSuccess, error: saveError } = useUpdateProfile();

    const { register, handleSubmit, reset } = useForm<ProfileForm>();

    useEffect(() => {
        if (!profile) return;
        reset({
            name: profile.name ?? "",
            bio: profile.bio ?? "",
            phone: profile.phone ?? "",
            github: profile.socialLinks?.github ?? "",
            twitter: profile.socialLinks?.twitter ?? "",
            linkedin: profile.socialLinks?.linkedin ?? "",
        });
    }, [profile, reset]);

    const onSubmit = (data: ProfileForm) => {
        saveProfile({
            name: data.name,
            bio: data.bio,
            phone: data.phone,
            socialLinks: {
                github: data.github,
                twitter: data.twitter,
                linkedin: data.linkedin,
            },
        });
    };

    if (isLoading) return <p className="p-8">Loading...</p>;
    if (isError) return <p className="p-8 text-red-500">Failed to load profile.</p>;

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-full max-w-md space-y-6">
                <h1 className="text-2xl font-bold">My Profile</h1>

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
                        <Label>GitHub</Label>
                        <Input {...register("github")} placeholder="https://github.com/username" />
                    </div>

                    <div className="space-y-1">
                        <Label>Twitter</Label>
                        <Input {...register("twitter")} placeholder="https://twitter.com/username" />
                    </div>

                    <div className="space-y-1">
                        <Label>LinkedIn</Label>
                        <Input {...register("linkedin")} placeholder="https://linkedin.com/in/username" />
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
