import FloatingShapes from "@/components/home/FloatingShapes";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, ImageIcon, Loader2, Upload } from "lucide-react";
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
    const [draftName, setDraftName] = useState<string | null>(null);
    const [draftDescription, setDraftDescription] = useState<string | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const [nameError, setNameError] = useState<string | null>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const storeName = draftName ?? store?.storeName ?? "";
    const description = draftDescription ?? store?.description ?? "";

    const handleImageChange =
        (kind: StoreImageKind) => (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            uploadImage.reset();
            if (!file.type.startsWith("image/")) {
                setImageError("Please select an image file.");
                return;
            }
            if (file.size > MAX_IMAGE_SIZE) {
                setImageError("Image must be 5 MB or smaller.");
                return;
            }
            setImageError(null);
            uploadImage.mutate({ kind, file });
        };

    const handleSave = (event: React.FormEvent) => {
        event.preventDefault();
        if (storeName.trim() === "") {
            setNameError("Store name cannot be empty.");
            return;
        }
        setNameError(null);
        updateStore.mutate({ storeName: storeName.trim(), description: description || null });
    };

    const uploading = (kind: StoreImageKind) => uploadImage.isPending && uploadImage.variables?.kind === kind;
    const logoInitial = (storeName.trim() || store?.storeName || "S").charAt(0).toUpperCase();

    return (
        <main className="store-settings-theme relative isolate min-h-[calc(100dvh-73px)] bg-background text-foreground">
            <FloatingShapes />
            <header className="relative z-10 overflow-hidden border-b border-border px-4 py-10 sm:px-8 sm:py-14">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,#e3e8d8_0%,transparent_70%)]" />
                <div className="relative mx-auto flex max-w-[1008px] flex-col justify-between gap-6 sm:flex-row sm:items-center">
                    <div>
                        <p className="mb-3 text-[10px] font-medium tracking-[0.22em] text-[#74796c]">YOUR CREATIVE STOREFRONT</p>
                        <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Store settings</h1>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">A little personality. A lasting first impression.</p>
                    </div>
                    {store && (
                        <Button asChild variant="outline" className="w-fit bg-white/70">
                            <Link to={`/stores/${store.sellerId}`}>View store<ArrowUpRight aria-hidden="true" className="size-4" /></Link>
                        </Button>
                    )}
                </div>
            </header>

            <div className="relative z-10 mx-auto max-w-[1072px] px-4 py-8 sm:px-8 sm:py-12">
                {isLoading ? (
                    <div role="status" className="space-y-5">
                        <p className="text-sm text-muted-foreground">Loading your store…</p>
                        <div aria-hidden="true" className="h-72 animate-pulse rounded-2xl border border-border bg-white motion-reduce:animate-none" />
                    </div>
                ) : isError || !store ? (
                    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Failed to load your store. Please try again later.</p>
                ) : (
                    <div className="space-y-10 sm:space-y-12">
                        <section aria-labelledby="branding-heading" className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10">
                            <div>
                                <h2 id="branding-heading" className="text-base font-semibold tracking-tight">Store appearance</h2>
                                <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Make it yours with a banner and logo that reflect your work.</p>
                            </div>
                            <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-white">
                                <div className="relative h-40 overflow-hidden bg-[#e9ecdf] sm:h-48">
                                    {store.bannerUrl ? (
                                        <img src={store.bannerUrl} alt="Your current store banner" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full flex-col items-center justify-center gap-2 bg-[radial-gradient(ellipse_at_top_right,#d5ddc7_0%,transparent_70%)] text-[#657152]">
                                            <ImageIcon aria-hidden="true" className="size-7 stroke-1" />
                                            <span className="text-xs">A blank canvas for your store</span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-6 p-5 sm:p-6">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-medium">Store banner</h3>
                                            <p className="mt-1 text-xs leading-5 text-muted-foreground">Use a wide image. Up to 5 MB.</p>
                                        </div>
                                        <Button type="button" variant="outline" size="sm" onClick={() => bannerInputRef.current?.click()} disabled={uploadImage.isPending}>
                                            {uploading("banner") ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" /> : <Upload aria-hidden="true" className="size-3.5" />}
                                            {uploading("banner") ? "Uploading…" : "Change banner"}
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4 border-t border-border pt-6">
                                        <Avatar className="size-16 ring-4 ring-[#f7f7f2] sm:size-20">
                                            {store.logoUrl && <AvatarImage src={store.logoUrl} alt={store.storeName} />}
                                            <AvatarFallback className="bg-secondary text-2xl font-medium text-[#657152]">{logoInitial}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-sm font-medium">Store logo</h3>
                                            <p className="mt-1 text-xs leading-5 text-muted-foreground">A square image works best. Up to 5 MB.</p>
                                        </div>
                                        <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadImage.isPending}>
                                            {uploading("logo") ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" /> : <Upload aria-hidden="true" className="size-3.5" />}
                                            {uploading("logo") ? "Uploading…" : "Change logo"}
                                        </Button>
                                    </div>
                                    <p className="text-xs leading-5 text-muted-foreground">Image changes are saved automatically.</p>
                                    {(imageError || uploadImage.isError) && <p role="alert" className="text-sm text-red-800">{imageError || "Image upload failed. Please try again."}</p>}
                                    {uploadImage.isSuccess && !imageError && <p role="status" className="flex items-center gap-2 text-sm text-[#465638]"><Check aria-hidden="true" className="size-4" />Store image updated.</p>}
                                </div>
                                <input ref={bannerInputRef} type="file" accept="image/*" aria-label="Upload store banner" className="hidden" onChange={handleImageChange("banner")} />
                                <input ref={logoInputRef} type="file" accept="image/*" aria-label="Upload store logo" className="hidden" onChange={handleImageChange("logo")} />
                            </div>
                        </section>

                        <section aria-labelledby="details-heading" className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10">
                            <div>
                                <h2 id="details-heading" className="text-base font-semibold tracking-tight">Store details</h2>
                                <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Introduce your store and tell buyers a little about what you create.</p>
                            </div>
                            <form onSubmit={handleSave} className="min-w-0 overflow-hidden rounded-2xl border border-border bg-white">
                                <div className="space-y-6 p-5 sm:p-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="storeName">Store name</Label>
                                        <Input id="storeName" value={storeName} disabled={updateStore.isPending} aria-invalid={!!nameError} aria-describedby={nameError ? "store-name-error" : undefined} onChange={(event) => { setDraftName(event.target.value); setNameError(null); updateStore.reset(); }} className="h-11 bg-[#fafbf7]" />
                                        {nameError && <p id="store-name-error" role="alert" className="text-sm text-red-800">{nameError}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
                                        <Textarea id="description" rows={5} value={description} disabled={updateStore.isPending} onChange={(event) => { setDraftDescription(event.target.value); updateStore.reset(); }} placeholder="Tell buyers about your work, your style, and what makes your store special…" className="min-h-32 resize-y bg-[#fafbf7] leading-6" aria-describedby="description-help" />
                                        <p id="description-help" className="text-xs leading-5 text-muted-foreground">Shown on your public storefront.</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-[#fafbf7] px-5 py-4 sm:px-6">
                                    <div aria-live="polite" className="text-xs text-muted-foreground">
                                        {updateStore.isError ? <p role="alert" className="text-red-800">Failed to save. Please try again.</p> : updateStore.isSuccess ? <p className="flex items-center gap-1.5 text-[#465638]"><Check aria-hidden="true" className="size-3.5" />Changes saved.</p> : <p>Save to update your store details.</p>}
                                    </div>
                                    <Button type="submit" disabled={updateStore.isPending} className="ml-auto">
                                        {updateStore.isPending && <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}
                                        {updateStore.isPending ? "Saving…" : "Save changes"}
                                    </Button>
                                </div>
                            </form>
                        </section>
                    </div>
                )}
            </div>
        </main>
    );
}
