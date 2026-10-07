import { useState } from "react";
import {
    ArrowLeft,
    ArrowRight,
    Building2,
    Check,
    Link2,
    Loader2,
    UserRound,
} from "lucide-react";
import { useUpdateAsset } from "../../hooks/useAsset";
import { getErrorMessage } from "../../lib/errors";
import type { AssetWithFiles, Currency, ListingType } from "../../types/asset";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";

export default function UploadPricingStep({
    asset,
    onBack,
    onNext,
}: {
    asset: AssetWithFiles;
    onBack: () => void;
    onNext: () => void;
}) {
    const update = useUpdateAsset();
    const [listingType, setListingType] = useState<ListingType>(
        asset.listingType,
    );
    const [currency, setCurrency] = useState<Currency>(asset.currency ?? "MYR");
    const [prices, setPrices] = useState({
        pricePersonal: asset.pricePersonal ?? "",
        priceCommercial: asset.priceCommercial ?? "",
    });
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);
    const traditional = listingType === "TRADITIONAL";
    const dirty = () => {
        setError("");
        setSaved(false);
    };

    const save = async (next: boolean) => {
        dirty();
        const personal =
            prices.pricePersonal.trim() === ""
                ? null
                : Number(prices.pricePersonal);
        const commercial =
            prices.priceCommercial.trim() === ""
                ? null
                : Number(prices.priceCommercial);
        if (
            traditional &&
            [personal, commercial].some(
                (value) =>
                    value !== null && (!Number.isFinite(value) || value < 0),
            )
        ) {
            setError("Enter a valid price of 0 or more.");
            return;
        }
        if (next && traditional && personal === null && commercial === null) {
            setError(
                "Set a Personal or Commercial license price before continuing. Use 0 for a free license.",
            );
            return;
        }
        if (next && !traditional) return;
        try {
            await update.mutateAsync({
                assetId: asset.id,
                payload: {
                    listingType,
                    currency,
                    pricePersonal: traditional ? personal : null,
                    priceCommercial: traditional ? commercial : null,
                    // Keep a previously saved blockchain price while its new form is on hold.
                    priceSol: traditional
                        ? null
                        : asset.priceSol === null
                          ? null
                          : Number(asset.priceSol),
                },
            });
            setSaved(true);
            if (next) onNext();
        } catch (err) {
            setError(getErrorMessage(err));
        }
    };

    return (
        <section className="pt-6" aria-labelledby="pricing-heading">
            <div className="mb-8 space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="mb-2 text-xs font-medium tracking-wider text-[#74796c]">
                            STEP 3 OF 3
                        </p>
                        <h2
                            id="pricing-heading"
                            className="text-2xl font-semibold tracking-tight sm:text-3xl"
                        >
                            Pricing & licensing
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Choose a license type and set your asset’s pricing.
                        </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                        100% complete
                    </span>
                </div>
                <div
                    role="progressbar"
                    aria-label="Upload steps"
                    aria-valuenow={3}
                    aria-valuemin={0}
                    aria-valuemax={3}
                    className="h-1.5 overflow-hidden rounded-full bg-[#e7e9e1]"
                >
                    <div className="h-full w-full rounded-full bg-[#657152]" />
                </div>
            </div>
            <form
                noValidate
                onSubmit={(event) => {
                    event.preventDefault();
                    void save(true);
                }}
                className="space-y-8"
            >
                <fieldset
                    disabled={update.isPending}
                    className="space-y-8 disabled:opacity-70"
                >
                    <fieldset className="space-y-3">
                        <legend className="mb-3 text-sm font-medium">
                            License type
                        </legend>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {(
                                [
                                    {
                                        value: "TRADITIONAL",
                                        title: "Traditional",
                                        description:
                                            "Offer Personal and Commercial licenses.",
                                        icon: UserRound,
                                    },
                                    {
                                        value: "BLOCKCHAIN",
                                        title: "Blockchain",
                                        description:
                                            "Blockchain license setup is coming soon.",
                                        icon: Link2,
                                    },
                                ] as const
                            ).map((option) => (
                                <label
                                    key={option.value}
                                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-5 transition-colors ${listingType === option.value ? "border-[#657152] bg-[#edf0e5]" : "border-[#dfe4d6] bg-white hover:border-[#9aa68a]"}`}
                                >
                                    <input
                                        type="radio"
                                        name="license-type"
                                        value={option.value}
                                        checked={listingType === option.value}
                                        onChange={() => {
                                            dirty();
                                            setListingType(option.value);
                                        }}
                                        className="mt-1 size-4 shrink-0 accent-[#657152]"
                                    />
                                    <span className="flex-1">
                                        <span className="flex items-center gap-2 font-semibold">
                                            <option.icon
                                                className="size-4 text-[#657152]"
                                                aria-hidden="true"
                                            />
                                            {option.title}
                                        </span>
                                        <span className="mt-2 block text-sm text-muted-foreground">
                                            {option.description}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    {traditional ? (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#ecefe5] p-5">
                                <div>
                                    <Label
                                        htmlFor="pricing-currency"
                                        className="text-base font-semibold"
                                    >
                                        Pricing currency
                                    </Label>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Applies to both license prices.
                                    </p>
                                </div>
                                <Select
                                    disabled={update.isPending}
                                    value={currency}
                                    onValueChange={(value) => {
                                        dirty();
                                        setCurrency(value as Currency);
                                    }}
                                >
                                    <SelectTrigger
                                        id="pricing-currency"
                                        className="h-12 data-[size=default]:h-12 min-w-36 gap-4 rounded-xl border-[#dfe4d6] bg-white px-4 font-medium shadow-none"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="USD">
                                            USD ($)
                                        </SelectItem>
                                        <SelectItem value="MYR">
                                            MYR (RM)
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-5 sm:grid-cols-2">
                                {(
                                    [
                                        {
                                            field: "pricePersonal",
                                            title: "Personal license",
                                            description:
                                                "Set a price for personal projects.",
                                            icon: UserRound,
                                        },
                                        {
                                            field: "priceCommercial",
                                            title: "Commercial license",
                                            description:
                                                "Set a price for commercial projects.",
                                            icon: Building2,
                                        },
                                    ] as const
                                ).map((tier) => (
                                    <div
                                        key={tier.field}
                                        className="rounded-2xl border border-[#dfe4d6] bg-white p-6 sm:p-7"
                                    >
                                        <h3 className="flex items-center gap-3 text-lg font-semibold">
                                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#edf0e5] text-[#657152]">
                                                <tier.icon
                                                    className="size-5"
                                                    aria-hidden="true"
                                                />
                                            </span>
                                            {tier.title}
                                        </h3>
                                        <p className="mb-7 mt-4 text-sm text-muted-foreground">
                                            {tier.description}
                                        </p>
                                        <Label
                                            htmlFor={`pricing-${tier.field}`}
                                            className="mb-2 block text-xs font-medium tracking-wider"
                                        >
                                            PRICE ({currency})
                                        </Label>
                                        <div className="relative">
                                            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-semibold text-[#657152]">
                                                {currency === "USD"
                                                    ? "$"
                                                    : "RM"}
                                            </span>
                                            <Input
                                                id={`pricing-${tier.field}`}
                                                type="number"
                                                min="0"
                                                step="any"
                                                inputMode="decimal"
                                                placeholder="Enter price"
                                                value={prices[tier.field]}
                                                aria-describedby="pricing-help"
                                                className="h-12 rounded-xl border-[#dfe4d6] bg-[#f7f7f2] pl-12 shadow-none"
                                                onChange={(event) => {
                                                    dirty();
                                                    setPrices((previous) => ({
                                                        ...previous,
                                                        [tier.field]:
                                                            event.target.value,
                                                    }));
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p
                                id="pricing-help"
                                className="text-sm text-muted-foreground"
                            >
                                Enter 0 for a free license. Leave a price blank
                                to keep that license unavailable. At least one
                                price is required to continue.
                            </p>
                        </>
                    ) : (
                        <div
                            className="rounded-2xl border border-[#d4dbc9] bg-[#edf0e5] p-6"
                            role="status"
                        >
                            <Link2
                                className="mb-4 size-6 text-[#657152]"
                                aria-hidden="true"
                            />
                            <h3 className="font-semibold">
                                Blockchain setup is on hold
                            </h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                The blockchain form will be added once its
                                fields are decided. You can save this choice as
                                a draft, or choose Traditional to set prices and
                                continue to review.
                            </p>
                        </div>
                    )}
                </fieldset>
                {error && (
                    <p
                        role="alert"
                        className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    >
                        {error}
                    </p>
                )}
                {saved && (
                    <p
                        role="status"
                        className="flex items-center gap-2 text-sm text-[#555e49]"
                    >
                        <Check className="size-4" aria-hidden="true" />
                        License and pricing saved.
                    </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e1e5d9] pt-6">
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={update.isPending}
                        className="h-11 px-3"
                        onClick={onBack}
                    >
                        <ArrowLeft className="size-4" />
                        Back
                    </Button>
                    <div className="flex flex-wrap gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={update.isPending}
                            className="h-11 px-5"
                            onClick={() => void save(false)}
                        >
                            <Check className="size-4" />
                            Save draft
                        </Button>
                        <Button
                            type="submit"
                            disabled={update.isPending || !traditional}
                            className="h-11 px-6"
                        >
                            {update.isPending ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    Preview & review
                                    <ArrowRight className="size-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </section>
    );
}
