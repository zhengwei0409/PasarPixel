import { useEffect, useRef } from "react";
import { useProfile } from "./useProfile";
import { useCurrencyStore } from "../stores/currencyStore";

/**
 * On login, seed the global currency store from the user's saved profile
 * preference, so their choice follows them across devices/browsers.
 *
 * Runs once per profile load (guarded by a ref) — after that the store is the
 * live source of truth, so toggling the switcher isn't overwritten on refetch.
 * Guests have no profile, so nothing happens and the localStorage value stands.
 */
export function useCurrencySync() {
    const { data: profile } = useProfile();
    const setDisplayCurrency = useCurrencyStore((s) => s.setDisplayCurrency);
    const seeded = useRef(false);

    useEffect(() => {
        if (seeded.current) return;
        if (!profile?.preferredCurrency) return;

        seeded.current = true;
        setDisplayCurrency(profile.preferredCurrency);
    }, [profile, setDisplayCurrency]);
}
