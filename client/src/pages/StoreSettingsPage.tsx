import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMyStore, useUpdateMyStore, useUploadStoreImage } from "@/hooks/useStore";
import type { StoreImageKind } from "@/types/store";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function StoreSettingsPage() {
    const { data: store, isLoading, isError } = useMyStore();
    const updateStore = useUpdateMyStore();
    const uploadImage = useUploadStoreImage();

    const [storeName, setStoreName] = useState("");
    const [description, setDescription] = useState("");

    const logoInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!store) return;
        setStoreName(store.storeName);
        setDescription(store.description ?? "");
    }, [store]);

    const handleImageChange =
        (kind: StoreImageKind) => (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (!file.type.startsWith("image/")) {
                alert("Please select an image file.");
                return;
            }
            if (file.size > MAX_IMAGE_SIZE) {
                alert("Image must be 5 MB or smaller.");
                return;
            }
            uploadImage.mutate({ kind, file });
        };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (storeName.trim() === "") {
            alert("Store name cannot be empty.");
            return;
        }
        updateStore.mutate({ storeName: storeName.trim(), description: description || null });
    };

    if (isLoading) return <p className="p-8 text-muted-foreground">Loading...</p>;
    if (isError || !store) return <p className="p-8 text-red-500">Failed to load store.</p>;

    const logoInitial = store.storeName.charAt(0).toUpperCase();

    return (
        <div className="min-h-screen p-8">
            <div className="mx-auto max-w-2xl space-y-8">
                <h1 className="text-2xl font-bold">Store Settings</h1>

                {/* Banner */}
                <div className="space-y-2">
                    <Label>Banner</Label>
                    <div className="h-32 w-full overflow-hidden rounded-lg bg-muted">
                        {store.bannerUrl && (
                            <img
                                src={store.bannerUrl}
                                alt="Store banner"
                                className="h-full w-full object-cover"
                            />
                        )}
                    </div>
                    <input
                        ref={bannerInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange("banner")}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => bannerInputRef.current?.click()}
                        disabled={uploadImage.isPending}
                    >
                        {uploadImage.isPending ? "Uploading..." : "Change banner"}
                    </Button>
                </div>

                {/* Logo */}
                <div className="space-y-2">
                    <Label>Logo</Label>
                    <div className="flex items-center gap-4">
                        <Avatar size="lg" className="h-20 w-20">
                            {store.logoUrl && (
                                <AvatarImage src={store.logoUrl} alt={store.storeName} />
                            )}
                            <AvatarFallback className="text-xl">{logoInitial}</AvatarFallback>
                        </Avatar>
                        <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageChange("logo")}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={uploadImage.isPending}
                        >
                            {uploadImage.isPending ? "Uploading..." : "Change logo"}
                        </Button>
                    </div>
                </div>

                {/* Name + description */}
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="storeName">Store name</Label>
                        <Input
                            id="storeName"
                            value={storeName}
                            onChange={(e) => setStoreName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            rows={4}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Tell buyers about your shop..."
                        />
                    </div>

                    {updateStore.isError && (
                        <p className="text-sm text-red-500">Failed to save. Please try again.</p>
                    )}
                    {updateStore.isSuccess && (
                        <p className="text-sm text-green-600">Saved.</p>
                    )}

                    <Button type="submit" disabled={updateStore.isPending}>
                        {updateStore.isPending ? "Saving..." : "Save changes"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
