import { useCurrencyStore } from "@/stores/currencyStore";
import { useSetCurrency } from "@/hooks/useSetCurrency";
import type { Currency } from "@/types/asset";

const CURRENCIES: Currency[] = ["MYR", "USD"];

// A small USD/MYR toggle bound to the global currency store. Used in the navbar
// (and reusable in the settings page) so the buyer's display currency is the
// same everywhere. Persists to the profile for logged-in users.
export default function CurrencySwitcher() {
    const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
    const setDisplayCurrency = useSetCurrency();

    return (
        <div className="flex gap-0.5 rounded-lg border border-[#e2e5dc] bg-[#f4f5ef] p-1 text-[11px] font-medium" role="group" aria-label="Display currency">
            {CURRENCIES.map((c) => (
                <button
                    key={c}
                    type="button"
                    onClick={() => setDisplayCurrency(c)}
                    aria-pressed={displayCurrency === c}
                    className={`cursor-pointer rounded-md px-2 py-1.5 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a8568] motion-reduce:transition-none ${
                        displayCurrency === c
                            ? "bg-white text-[#30392b] shadow-sm"
                            : "text-[#85897f] hover:bg-[#e9ecdf] hover:text-[#555e49]"
                    }`}
                >
                    {c}
                </button>
            ))}
        </div>
    );
}
