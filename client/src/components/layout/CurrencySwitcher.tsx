import { useCurrencyStore } from "@/stores/currencyStore";
import type { Currency } from "@/types/asset";

const CURRENCIES: Currency[] = ["MYR", "USD"];

// A small USD/MYR toggle bound to the global currency store. Used in the navbar
// (and reusable in the settings page) so the buyer's display currency is the
// same everywhere.
export default function CurrencySwitcher() {
    const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
    const setDisplayCurrency = useCurrencyStore((s) => s.setDisplayCurrency);

    return (
        <div className="flex gap-1 rounded-md border p-0.5 text-xs" role="group" aria-label="Display currency">
            {CURRENCIES.map((c) => (
                <button
                    key={c}
                    type="button"
                    onClick={() => setDisplayCurrency(c)}
                    className={`rounded px-2 py-1 transition ${
                        displayCurrency === c
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    {c}
                </button>
            ))}
        </div>
    );
}
