import { useParams } from "react-router-dom";
import { useStore, useStoreAssets } from "@/hooks/useStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AssetCard from "@/components/marketplace/AssetCard";

export default function StorePage() {
    const { sellerId: sellerIdParam } = useParams<{ sellerId: string }>();
    const sellerId = sellerIdParam ? parseInt(sellerIdParam) : NaN;
    const validId = !isNaN(sellerId);

    const { data: store, isLoading, error } = useStore(validId ? sellerId : null);
    const { data: assetsData } = useStoreAssets(validId ? sellerId : null);

    if (!validId) {
        return <p className="p-8 text-muted-foreground">Invalid store.</p>;
    }
    if (isLoading) {
        return <p className="p-8 text-muted-foreground">Loading...</p>;
    }
    if (error || !store) {
        return <p className="p-8 text-muted-foreground">Store not found.</p>;
    }

    const items = assetsData?.items ?? [];
    const initial = store.storeName.charAt(0).toUpperCase();

    return (
        <div className="min-h-screen">
            {/* Banner */}
            <div className="h-40 w-full bg-muted sm:h-56">
                {store.bannerUrl && (
                    <img
                        src={store.bannerUrl}
                        alt={`${store.storeName} banner`}
                        className="h-full w-full object-cover"
                    />
                )}
            </div>

            <div className="mx-auto max-w-5xl px-6">
                {/* Logo + name, pulled up over the banner */}
                <div className="-mt-12 flex items-end gap-4">
                    <Avatar size="lg" className="h-24 w-24 border-4 border-background">
                        {store.logoUrl && <AvatarImage src={store.logoUrl} alt={store.storeName} />}
                        <AvatarFallback className="text-2xl">{initial}</AvatarFallback>
                    </Avatar>
                    <div className="pb-2">
                        <h1 className="text-2xl font-bold">{store.storeName}</h1>
                    </div>
                </div>

                {store.description && (
                    <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
                        {store.description}
                    </p>
                )}

                <h2 className="mb-4 mt-8 text-lg font-semibold">
                    Listings {items.length > 0 && `(${items.length})`}
                </h2>

                {items.length === 0 ? (
                    <p className="pb-12 text-muted-foreground">No listings yet.</p>
                ) : (
                    <div className="grid grid-cols-2 gap-4 pb-12 sm:grid-cols-3 lg:grid-cols-4">
                        {items.map((asset) => (
                            <AssetCard key={asset.id} asset={asset} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
