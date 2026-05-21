import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import mainApi from "../lib/mainApi";

interface ProfileForm {
    name: string;
    bio: string;
    phone: string;
    github: string;
    twitter: string;
    linkedin: string;
}

interface UserProfile {
    name: string;
    bio: string | null;
    phone: string | null;
    socialLinks: { github?: string; twitter?: string; linkedin?: string } | null;
}

export default function ProfilePage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { register, handleSubmit, reset } = useForm<ProfileForm>();

    useEffect(() => {
        mainApi.get<UserProfile>("/profile/me").then((res) => {
            const { name, bio, phone, socialLinks } = res.data;
            reset({
                name: name ?? "",
                bio: bio ?? "",
                phone: phone ?? "",
                github: socialLinks?.github ?? "",
                twitter: socialLinks?.twitter ?? "",
                linkedin: socialLinks?.linkedin ?? "",
            });
            setLoading(false);
        }).catch(() => {
            setError("Failed to load profile.");
            setLoading(false);
        });
    }, [reset]);

    async function onSubmit(data: ProfileForm) {
        setSaving(true);
        setSuccess(false);
        setError(null);

        try {
            await mainApi.patch("/profile/me", {
                name: data.name,
                bio: data.bio,
                phone: data.phone,
                socialLinks: {
                    github: data.github,
                    twitter: data.twitter,
                    linkedin: data.linkedin,
                },
            });
            setSuccess(true);
        } catch {
            setError("Failed to save profile.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <p className="p-8">Loading...</p>;

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

                    {success && <p className="text-sm text-green-600">Profile saved successfully.</p>}
                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <Button type="submit" className="w-full" disabled={saving}>
                        {saving ? "Saving..." : "Save Profile"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
