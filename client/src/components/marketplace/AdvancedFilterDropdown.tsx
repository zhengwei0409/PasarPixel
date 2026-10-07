import { useId, useState } from "react";
import { Popover, Tabs } from "radix-ui";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FORMAT_OPTIONS, ORIENTATION_OPTIONS } from "@/lib/assetSpecifications";
import type { AssetCategory } from "@/types/asset";

type Option = { value: string; label: string };
type FilterGroup = {
    key: string;
    label: string;
    type: "multi" | "select" | "duration";
    options?: Option[];
    note?: string;
    emptyLabel?: string;
    maxKey?: string;
};

function groupsFor(category: AssetCategory): FilterGroup[] {
    const format: FilterGroup = { key: `${category === "THREE_D_MODEL" ? "model" : category === "SOUND_EFFECT" ? "audio" : category.toLowerCase()}Format`, label: category === "ANIMATION" ? "Download file format" : "File format", type: "multi", options: FORMAT_OPTIONS[category] };
    if (category === "IMAGE" || category === "VIDEO") {
        const prefix = category.toLowerCase();
        return [
            { key: `${prefix}Orientation`, label: "Orientation", type: "multi", options: ORIENTATION_OPTIONS },
            { key: `${prefix}MinResolution`, label: "Minimum resolution", type: "select", emptyLabel: "Any resolution", options: category === "IMAGE" ? [{ value: "1920", label: "HD — 1920px+" }, { value: "3840", label: "4K — 3840px+" }] : [{ value: "720", label: "HD — 720p+" }, { value: "1080", label: "Full HD — 1080p+" }, { value: "2160", label: "4K — 2160p+" }], note: `Measured by the ${category === "IMAGE" ? "longest" : "shorter"} side.` },
            format,
            ...(category === "VIDEO" ? [
                { key: "videoMinDuration", maxKey: "videoMaxDuration", label: "Duration (seconds)", type: "duration" as const },
                { key: "videoMinFrameRate", label: "Minimum frame rate", type: "select" as const, emptyLabel: "Any frame rate", options: ["24", "30", "60"].map((value) => ({ value, label: `${value} fps+` })) },
            ] : []),
        ];
    }
    if (category === "SOUND_EFFECT") return [
        { key: "audioType", label: "Audio type", type: "multi", options: [{ value: "MUSIC", label: "Music" }, { value: "SOUND_EFFECT", label: "Sound effect" }] },
        format,
        { key: "audioMinDuration", maxKey: "audioMaxDuration", label: "Duration (seconds)", type: "duration" },
    ];
    return [format];
}

export default function AdvancedFilterDropdown({ category, categoryLabel, searchParams, onApply }: {
    category: AssetCategory;
    categoryLabel: string;
    searchParams: URLSearchParams;
    onApply: (draft: URLSearchParams, keys: string[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(() => new URLSearchParams(searchParams));
    const id = useId();
    const groups = groupsFor(category);
    const invalidDuration = groups.some((group) => {
        if (group.type !== "duration") return false;
        const min = draft.get(group.key) ?? "";
        const max = draft.get(group.maxKey!) ?? "";
        return [min, max].some((value) => value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0)) || (min !== "" && max !== "" && Number(min) > Number(max));
    });
    const setValue = (key: string, value: string, multi = false) => {
        setDraft((previous) => {
            const next = new URLSearchParams(previous);
            if (multi) {
                const values = new Set(next.getAll(key));
                if (values.has(value)) values.delete(value);
                else values.add(value);
                next.delete(key);
                values.forEach((item) => next.append(key, item));
            } else if (!value || value === "ALL") next.delete(key);
            else next.set(key, value);
            return next;
        });
    };

    return (
        <Popover.Root open={open} onOpenChange={(nextOpen) => { if (nextOpen) setDraft(new URLSearchParams(searchParams)); setOpen(nextOpen); }}>
            <Popover.Trigger asChild>
                <Button variant="outline" className="h-11 shrink-0 gap-2 rounded-lg border-[#dfe4d6] bg-[#fcfcfa] px-4 text-xs font-normal text-[#555e49] hover:bg-[#eceee7] hover:text-[#555e49] focus-visible:ring-[#7a8568]/20 aria-expanded:bg-[#fcfcfa] aria-expanded:text-[#555e49]">
                    <SlidersHorizontal className="size-4" aria-hidden="true" />Filters<ChevronDown className="size-4" aria-hidden="true" />
                </Button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content align="start" sideOffset={10} collisionPadding={16} aria-labelledby={`${id}-title`} className="z-50 flex max-h-[min(640px,var(--radix-popover-content-available-height))] w-[min(600px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-[#dfe4d6] bg-[#fcfcfa] text-[#252823] shadow-lg outline-none">
                    <header className="flex shrink-0 items-center justify-between border-b border-[#e7e9e1] px-4 py-3">
                        <div><h2 id={`${id}-title`} className="text-base font-semibold">Filters</h2><p className="mt-1 text-xs text-[#73776e]">{categoryLabel}</p></div>
                        <Popover.Close asChild><Button variant="ghost" size="icon" aria-label="Close filters"><X className="size-4" /></Button></Popover.Close>
                    </header>
                    <Tabs.Root defaultValue={groups[0].key} orientation="vertical" className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:flex-row">
                        <Tabs.List aria-label="Advanced filter sections" className="flex shrink-0 flex-wrap gap-1 border-b border-[#e7e9e1] p-3 sm:w-40 sm:flex-col sm:justify-start sm:border-r sm:border-b-0 sm:p-3">
                            {groups.map((group) => <Tabs.Trigger key={group.key} value={group.key} className="rounded-md px-3 py-2 text-left text-xs text-[#73776e] outline-none hover:bg-[#eceee7] focus-visible:ring-2 focus-visible:ring-[#7a8568] data-[state=active]:bg-[#e3e8d8] data-[state=active]:font-medium data-[state=active]:text-[#30392b]">{group.label}</Tabs.Trigger>)}
                        </Tabs.List>
                        <div className="min-w-0 flex-1 p-4">
                            {groups.map((group) => <Tabs.Content key={group.key} value={group.key} className="outline-none focus-visible:ring-2 focus-visible:ring-[#7a8568]">
                                <h3 className="mb-3 text-sm font-medium">{group.label}</h3>
                                {group.type === "multi" && <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
                                    {group.options!.map((option) => <label key={option.value} className="flex cursor-pointer items-center gap-3 text-sm text-[#555e49]">
                                        <input type="checkbox" checked={draft.getAll(group.key).includes(option.value)} onChange={() => setValue(group.key, option.value, true)} className="size-5 shrink-0 accent-[#657152] focus-visible:outline-2 focus-visible:outline-[#7a8568]" />{option.label}
                                    </label>)}
                                </div>}
                                {group.type === "select" && <Select value={draft.get(group.key) ?? "ALL"} onValueChange={(value) => setValue(group.key, value)}>
                                    <SelectTrigger aria-label={group.label} size="sm" className="w-full max-w-[240px] rounded-md border-[#dfe4d6] bg-white px-2.5 text-xs shadow-none focus-visible:ring-[#7a8568]/20"><SelectValue /></SelectTrigger>
                                    <SelectContent position="popper" align="start" className="bg-[#fcfcfa] text-[#252823] [&_[data-slot=select-item]]:text-xs"><SelectItem value="ALL">{group.emptyLabel}</SelectItem>{group.options!.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                                </Select>}
                                {group.type === "duration" && <div className="grid grid-cols-2 gap-4">
                                    {[{ key: group.key, label: "Minimum", placeholder: "0" }, { key: group.maxKey!, label: "Maximum", placeholder: "Any" }].map((field) => <div key={field.key}>
                                        <Label htmlFor={`${id}-${field.key}`} className="mb-2 text-xs text-[#73776e]">{field.label}</Label>
                                        <Input id={`${id}-${field.key}`} type="number" min="0" step="any" placeholder={field.placeholder} value={draft.get(field.key) ?? ""} onChange={(event) => setValue(field.key, event.target.value)} className="h-10 border-[#dfe4d6] bg-white" />
                                    </div>)}
                                </div>}
                                {group.note && <p className="mt-2 text-[11px] text-[#85897f]">{group.note}</p>}
                            </Tabs.Content>)}
                        </div>
                    </Tabs.Root>
                    <footer className="shrink-0 border-t border-[#e7e9e1] px-4 py-3">
                        {invalidDuration && <p role="alert" className="mb-3 text-xs text-destructive">Durations must be non-negative, and maximum must be at least the minimum.</p>}
                        <Button disabled={invalidDuration} onClick={() => { onApply(draft, groups.flatMap((group) => group.maxKey ? [group.key, group.maxKey] : [group.key])); setOpen(false); }} className="h-8 rounded-md bg-[#657152] px-4 text-xs text-white hover:bg-[#555e49]">Apply filters</Button>
                    </footer>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
