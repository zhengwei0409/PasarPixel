import { useCurrencyStore } from "@/stores/currencyStore";
import { useSetCurrency } from "@/hooks/useSetCurrency";
import TwoFactorSection from "@/components/settings/TwoFactorSection";
import type { Currency } from "@/types/asset";

const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
    { value: "MYR", label: "Malaysian Ringgit (RM)" },
    { value: "USD", label: "US Dollar ($)" },
];

export default function SettingsPage() {
    const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
    const setCurrency = useSetCurrency();

    return (
        <div className="mx-auto max-w-2xl px-6 py-8">
            <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

            <section className="rounded-lg border p-5">
                <h2 className="text-sm font-medium">Display currency</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                    Prices across the marketplace, cart, and checkout are shown — and
                    charged — in this currency.
                </p>

                <div className="space-y-2">
                    {CURRENCY_OPTIONS.map((opt) => {
                        const selected = displayCurrency === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setCurrency(opt.value)}
                                className={`flex w-full items-center justify-between rounded-md border px-4 py-3 text-left text-sm transition ${
                                    selected
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-foreground/30"
                                }`}
                            >
                                <span>{opt.label}</span>
                                {selected && (
                                    <span className="text-xs font-medium text-primary">
                                        Selected
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </section>

            <TwoFactorSection />
        </div>
    );
}
