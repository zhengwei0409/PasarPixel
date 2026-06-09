import type { AssetSeller } from "@/types/asset";

// The marketplace shows the SHOP, not the seller's personal account. Use the
// store's name + logo only. When there's no logo yet we show an initial-letter
// placeholder (the AvatarFallback) — never the seller's personal avatar, which
// would blur the line between the shop and the person. `name` still falls back
// to the personal name for legacy assets whose seller has no store row yet.
export function shopDisplay(seller: AssetSeller) {
    const name = seller.store?.storeName ?? seller.name;
    return {
        name,
        logoUrl: seller.store?.logoUrl ?? null,
        initial: name.charAt(0).toUpperCase(),
    };
}
