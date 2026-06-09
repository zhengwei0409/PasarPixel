import type { AssetSeller } from "@/types/asset";

// The marketplace shows the SHOP, not the seller's personal account. Prefer the
// store's name/logo; fall back to the personal name/avatar for legacy assets
// whose seller hasn't got a store yet.
export function shopDisplay(seller: AssetSeller) {
    const name = seller.store?.storeName ?? seller.name;
    return {
        name,
        logoUrl: seller.store?.logoUrl ?? seller.avatarUrl,
        initial: name.charAt(0).toUpperCase(),
    };
}
