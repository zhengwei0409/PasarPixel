import { ORIENTATION_OPTIONS, IMAGE_FORMATS, VIDEO_FORMATS, ANIMATION_FORMATS, MODEL_FORMATS, FONT_FORMATS, AUDIO_FORMATS } from "../lib/assetSpecifications";
import { useState, useMemo, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBrowseAssets } from "@/hooks/useAsset";
import { useDebounce } from "@/hooks/useDebounce";
import AssetCard from "@/components/marketplace/AssetCard";
import AudioAssetRow from "@/components/marketplace/AudioAssetRow";
import FontAssetRow from "@/components/marketplace/FontAssetRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { AssetCategory, BrowseAssetsParams, BrowseSort, ListingType } from "@/types/asset";

const CATEGORY_OPTIONS: { value: AssetCategory; label: string }[] = [
    { value: "THREE_D_MODEL", label: "3D models" },
    { value: "IMAGE", label: "Images" },
    { value: "VIDEO", label: "Videos" },
    { value: "SOUND_EFFECT", label: "Audio" },
    { value: "FONT", label: "Fonts" },
    { value: "ANIMATION", label: "Animations" },
];

const SORT_OPTIONS: { value: BrowseSort; label: string }[] = [
    { value: "newest", label: "Newest" },
    { value: "best_selling", label: "Best selling" },
    { value: "price_asc", label: "Price: Low to High" },
    { value: "price_desc", label: "Price: High to Low" },
];







const AUDIO_TYPES = [
    { value: "MUSIC", label: "Music" },
    { value: "SOUND_EFFECT", label: "Sound effect" },
];

const VIDEO_RESOLUTIONS = [
    { value: "720", label: "HD — 720p+" },
    { value: "1080", label: "Full HD — 1080p+" },
    { value: "2160", label: "4K — 2160p+" },
];
const ALL = "ALL";
const PAGE_SIZE = 18;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]";

function FilterOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
    return (
        <label className="flex cursor-pointer items-center gap-3 py-1.5 text-sm text-[#73776e] hover:text-[#30392b]">
            <input type="checkbox" checked={checked} onChange={onChange} className="size-4 shrink-0 cursor-pointer accent-[#657152] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]" />
            <span className={checked ? "font-medium text-[#30392b]" : ""}>{label}</span>
        </label>
    );
}

function AdvancedFilters({ category, children }: { category: string; children: ReactNode }) {
    return (
        <details className="group border-t border-[#e7e9e1] pt-6">
            <summary className={cn("flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-[#252823] hover:text-[#657152] [&::-webkit-details-marker]:hidden", FOCUS)}>
                <span>
                    <span className="text-sm font-semibold">Advanced filters</span>
                    <span className="mt-1 block text-xs text-[#85897f]">{category}</span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-[#657152] transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </summary>
            <div className="space-y-5 pt-5">{children}</div>
        </details>
    );
}

export default function MarketplacePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const keyword = searchParams.get("keyword") ?? "";
    const selectedCategories = CATEGORY_OPTIONS.filter((option) =>
        searchParams.getAll("category").includes(option.value),
    );
    const toggleCategory = (value: AssetCategory) => {
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            const categories = new Set(next.getAll("category"));
            if (categories.has(value)) categories.delete(value);
            else categories.add(value);
            next.delete("category");
            CATEGORY_OPTIONS.forEach((option) => {
                if (categories.has(option.value)) next.append("category", option.value);
            });
            return next;
        }, { replace: true });
    };
    const imagesSelected = selectedCategories.some((option) => option.value === "IMAGE");
    const orientations = ORIENTATION_OPTIONS.filter((option) => searchParams.getAll("imageOrientation").includes(option.value));
    const imageFormats = IMAGE_FORMATS.filter((option) => searchParams.getAll("imageFormat").includes(option.value));
    const resolutionParam = searchParams.get("imageMinResolution");
    const resolution = resolutionParam === "1920" || resolutionParam === "3840" ? resolutionParam : ALL;
    const toggleMultiParam = (key: string, value: string) => {
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            const values = new Set(next.getAll(key));
            if (values.has(value)) values.delete(value);
            else values.add(value);
            next.delete(key);
            values.forEach((item) => next.append(key, item));
            return next;
        }, { replace: true });
    };
    const imageParams: BrowseAssetsParams = {
        ...(orientations.length ? { imageOrientation: orientations.map((option) => option.value).join(",") } : {}),
        ...(imageFormats.length ? { imageFormat: imageFormats.map((option) => option.value).join(",") } : {}),
        ...(resolution !== ALL ? { imageMinResolution: Number(resolution) } : {}),
    };
    const imageFilterKey = JSON.stringify(imageParams);
    const videosSelected = selectedCategories.some((option) => option.value === "VIDEO");
    const videoOrientations = ORIENTATION_OPTIONS.filter((option) => searchParams.getAll("videoOrientation").includes(option.value));
    const videoFormats = VIDEO_FORMATS.filter((option) => searchParams.getAll("videoFormat").includes(option.value));
    const videoResolution = VIDEO_RESOLUTIONS.find((option) => option.value === searchParams.get("videoMinResolution"))?.value ?? ALL;
    const frameRateParam = searchParams.get("videoMinFrameRate");
    const frameRate = ["24", "30", "60"].includes(frameRateParam ?? "") ? frameRateParam! : ALL;
    const minDuration = searchParams.get("videoMinDuration") ?? "";
    const maxDuration = searchParams.get("videoMaxDuration") ?? "";
    const debouncedMinDuration = useDebounce(minDuration, 300);
    const debouncedMaxDuration = useDebounce(maxDuration, 300);
    const validMinDuration = debouncedMinDuration.trim() !== "" && Number.isFinite(Number(debouncedMinDuration)) && Number(debouncedMinDuration) >= 0;
    const validMaxDuration = debouncedMaxDuration.trim() !== "" && Number.isFinite(Number(debouncedMaxDuration)) && Number(debouncedMaxDuration) >= 0;
    const videoParams: BrowseAssetsParams = {
        ...(videoOrientations.length ? { videoOrientation: videoOrientations.map((option) => option.value).join(",") } : {}),
        ...(videoFormats.length ? { videoFormat: videoFormats.map((option) => option.value).join(",") } : {}),
        ...(videoResolution !== ALL ? { videoMinResolution: Number(videoResolution) } : {}),
        ...(frameRate !== ALL ? { videoMinFrameRate: Number(frameRate) } : {}),
        ...(validMinDuration ? { videoMinDuration: Number(debouncedMinDuration) } : {}),
        ...(validMaxDuration ? { videoMaxDuration: Number(debouncedMaxDuration) } : {}),
    };
    const videoFilterKey = JSON.stringify(videoParams);
    const audioSelected = selectedCategories.some((option) => option.value === "SOUND_EFFECT");
    const audioTypes = AUDIO_TYPES.filter((option) => searchParams.getAll("audioType").includes(option.value));
    const audioFormats = AUDIO_FORMATS.filter((option) => searchParams.getAll("audioFormat").includes(option.value));
    const audioMinDuration = searchParams.get("audioMinDuration") ?? "";
    const audioMaxDuration = searchParams.get("audioMaxDuration") ?? "";
    const debouncedAudioMinDuration = useDebounce(audioMinDuration, 300);
    const debouncedAudioMaxDuration = useDebounce(audioMaxDuration, 300);
    const validAudioMinDuration = debouncedAudioMinDuration.trim() !== "" && Number.isFinite(Number(debouncedAudioMinDuration)) && Number(debouncedAudioMinDuration) >= 0;
    const validAudioMaxDuration = debouncedAudioMaxDuration.trim() !== "" && Number.isFinite(Number(debouncedAudioMaxDuration)) && Number(debouncedAudioMaxDuration) >= 0;
    const audioParams: BrowseAssetsParams = {
        ...(audioTypes.length ? { audioType: audioTypes.map((option) => option.value).join(",") } : {}),
        ...(audioFormats.length ? { audioFormat: audioFormats.map((option) => option.value).join(",") } : {}),
        ...(validAudioMinDuration ? { audioMinDuration: Number(debouncedAudioMinDuration) } : {}),
        ...(validAudioMaxDuration ? { audioMaxDuration: Number(debouncedAudioMaxDuration) } : {}),
    };
    const audioFilterKey = JSON.stringify(audioParams);
    const fontsSelected = selectedCategories.some((option) => option.value === "FONT");
    const fontFormats = FONT_FORMATS.filter((option) => searchParams.getAll("fontFormat").includes(option.value));
    const fontParams: BrowseAssetsParams = {
        ...(fontFormats.length ? { fontFormat: fontFormats.map((option) => option.value).join(",") } : {}),
    };
    const fontFilterKey = JSON.stringify(fontParams);
    const modelsSelected = selectedCategories.some((option) => option.value === "THREE_D_MODEL");
    const modelFormats = MODEL_FORMATS.filter((option) => searchParams.getAll("modelFormat").includes(option.value));
    const modelParams: BrowseAssetsParams = {
        ...(modelFormats.length ? { modelFormat: modelFormats.map((option) => option.value).join(",") } : {}),
    };
    const modelFilterKey = JSON.stringify(modelParams);
    const animationsSelected = selectedCategories.some((option) => option.value === "ANIMATION");
    const animationFormats = ANIMATION_FORMATS.filter((option) => searchParams.getAll("animationFormat").includes(option.value));
    const animationParams: BrowseAssetsParams = {
        ...(animationFormats.length ? { animationFormat: animationFormats.map((option) => option.value).join(",") } : {}),
    };
    const animationFilterKey = JSON.stringify(animationParams);
    const sortParam = searchParams.get("sort");
    const sort = SORT_OPTIONS.some((option) => option.value === sortParam)
        ? sortParam as BrowseSort : "newest";

    const setBrowseParam = (key: string, value: string) => {
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            if (!value || value === ALL) next.delete(key);
            else next.set(key, value);
            return next;
        }, { replace: true });
    };
    const [listingType, setListingType] = useState<ListingType | typeof ALL>(ALL);
    const [aiFilter, setAiFilter] = useState<"ALL" | "AI" | "HUMAN">(ALL);
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(false);

    const debouncedKeyword = useDebounce(keyword, 300);
    const debouncedMin = useDebounce(minPrice, 300);
    const debouncedMax = useDebounce(maxPrice, 300);

    const filterKey = JSON.stringify([
        debouncedKeyword,
        listingType,
        aiFilter,
        debouncedMin,
        debouncedMax,
        sort,
    ]);
    const params = useMemo(() => {
        const p: BrowseAssetsParams = { sort, pageSize: PAGE_SIZE };
        if (debouncedKeyword.trim()) p.keyword = debouncedKeyword.trim();
        if (listingType !== ALL) p.listingType = listingType;
        if (aiFilter === "AI") p.isAiGenerated = true;
        else if (aiFilter === "HUMAN") p.isAiGenerated = false;
        const min = parseFloat(debouncedMin);
        const max = parseFloat(debouncedMax);
        if (!isNaN(min) && min >= 0) p.minPrice = min;
        if (!isNaN(max) && max >= 0) p.maxPrice = max;
        return p;
    }, [debouncedKeyword, listingType, aiFilter, debouncedMin, debouncedMax, sort]);

    const clearFilters = () => {
        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            next.delete("keyword");
            next.delete("category");
            next.delete("imageOrientation");
            next.delete("imageFormat");
            next.delete("imageMinResolution");
            next.delete("fontFormat");
            next.delete("modelFormat");
            next.delete("animationFormat");
            ["audioType", "audioFormat", "audioMinDuration", "audioMaxDuration"].forEach((key) => next.delete(key));
            ["videoOrientation", "videoFormat", "videoMinResolution", "videoMinFrameRate", "videoMinDuration", "videoMaxDuration"].forEach((key) => next.delete(key));
            return next;
        }, { replace: true });
        setListingType(ALL);
        setAiFilter(ALL);
        setMinPrice("");
        setMaxPrice("");
    };
    const activeFilters = [
        ...(keyword.trim() ? [{ key: "keyword", label: keyword.trim(), remove: () => setBrowseParam("keyword", "") }] : []),
        ...selectedCategories.map((option) => ({ key: option.value, label: option.label, remove: () => toggleCategory(option.value) })),
        ...(imagesSelected ? [
            ...orientations.map((option) => ({ key: `orientation-${option.value}`, label: `Images: ${option.label}`, remove: () => toggleMultiParam("imageOrientation", option.value) })),
            ...imageFormats.map((option) => ({ key: `format-${option.value}`, label: `Images: ${option.label}`, remove: () => toggleMultiParam("imageFormat", option.value) })),
            ...(resolution !== ALL ? [{ key: "resolution", label: `Images: ${resolution === "1920" ? "HD" : "4K"}+`, remove: () => setBrowseParam("imageMinResolution", ALL) }] : []),
        ] : []),
        ...(videosSelected ? [
            ...videoOrientations.map((option) => ({ key: `video-orientation-${option.value}`, label: `Videos: ${option.label}`, remove: () => toggleMultiParam("videoOrientation", option.value) })),
            ...videoFormats.map((option) => ({ key: `video-format-${option.value}`, label: `Videos: ${option.label}`, remove: () => toggleMultiParam("videoFormat", option.value) })),
            ...(videoResolution !== ALL ? [{ key: "video-resolution", label: `Videos: ${VIDEO_RESOLUTIONS.find((option) => option.value === videoResolution)!.label}`, remove: () => setBrowseParam("videoMinResolution", ALL) }] : []),
            ...(frameRate !== ALL ? [{ key: "video-frame-rate", label: `Videos: ${frameRate} fps+`, remove: () => setBrowseParam("videoMinFrameRate", ALL) }] : []),
            ...(minDuration ? [{ key: "video-min-duration", label: `Videos: ${minDuration}s minimum`, remove: () => setBrowseParam("videoMinDuration", "") }] : []),
            ...(maxDuration ? [{ key: "video-max-duration", label: `Videos: ${maxDuration}s maximum`, remove: () => setBrowseParam("videoMaxDuration", "") }] : []),
        ] : []),
        ...(animationsSelected ? animationFormats.map((option) => ({ key: `animation-format-${option.value}`, label: `Animations: ${option.label}`, remove: () => toggleMultiParam("animationFormat", option.value) })) : []),
        ...(modelsSelected ? modelFormats.map((option) => ({ key: `model-format-${option.value}`, label: `3D models: ${option.label}`, remove: () => toggleMultiParam("modelFormat", option.value) })) : []),
        ...(fontsSelected ? fontFormats.map((option) => ({ key: `font-format-${option.value}`, label: `Fonts: ${option.label}`, remove: () => toggleMultiParam("fontFormat", option.value) })) : []),
        ...(audioSelected ? [
            ...audioTypes.map((option) => ({ key: `audio-type-${option.value}`, label: `Audio: ${option.label}`, remove: () => toggleMultiParam("audioType", option.value) })),
            ...audioFormats.map((option) => ({ key: `audio-format-${option.value}`, label: `Audio: ${option.label}`, remove: () => toggleMultiParam("audioFormat", option.value) })),
            ...(audioMinDuration ? [{ key: "audio-min-duration", label: `Audio: ${audioMinDuration}s minimum`, remove: () => setBrowseParam("audioMinDuration", "") }] : []),
            ...(audioMaxDuration ? [{ key: "audio-max-duration", label: `Audio: ${audioMaxDuration}s maximum`, remove: () => setBrowseParam("audioMaxDuration", "") }] : []),
        ] : []),
        ...(listingType !== ALL ? [{ key: "listing", label: listingType === "TRADITIONAL" ? "Traditional" : "Blockchain", remove: () => setListingType(ALL) }] : []),
        ...(aiFilter !== ALL ? [{ key: "source", label: aiFilter === "AI" ? "AI-generated" : "Human-made", remove: () => setAiFilter(ALL) }] : []),
        ...(minPrice ? [{ key: "min", label: `Min price: ${minPrice}`, remove: () => setMinPrice("") }] : []),
        ...(maxPrice ? [{ key: "max", label: `Max price: ${maxPrice}`, remove: () => setMaxPrice("") }] : []),
    ];
    return (
        <main className="min-h-[calc(100dvh-73px)] bg-[#f7f7f2] text-[#252823]">
            <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
                <aside aria-label="Marketplace filters" className="border-b border-[#e7e9e1] bg-[#fcfcfa]/60 lg:border-r lg:border-b-0">
                    <div className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:py-7">
                        <h2 className="hidden text-xs font-semibold tracking-[0.14em] text-[#555e49] lg:block">FILTERS</h2>
                        <button type="button" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} aria-controls="marketplace-filters" className={cn("flex items-center gap-2 rounded-sm text-sm font-medium lg:hidden", FOCUS)}>
                            <SlidersHorizontal className="size-4" aria-hidden="true" />Filters
                            {activeFilters.length > 0 && <span className="rounded-full bg-[#e3e8d8] px-2 py-0.5 text-xs text-[#555e49]">{activeFilters.length}</span>}
                        </button>
                        <button type="button" onClick={clearFilters} disabled={!activeFilters.length} className={cn("rounded-sm text-xs font-medium text-[#657152] hover:underline disabled:opacity-40", FOCUS)}>Clear all</button>
                    </div>
                    <div id="marketplace-filters" className={cn("space-y-8 px-5 pb-8 sm:px-8 lg:block lg:pt-4", !filtersOpen && "hidden")}>
                        <fieldset>
                            <legend className="mb-3 text-sm font-semibold">Category</legend>
                            <p className="mb-2 text-xs text-[#85897f]">Select one or more categories</p>
                            {CATEGORY_OPTIONS.map((option) => <FilterOption key={option.value} label={option.label} checked={selectedCategories.some((selected) => selected.value === option.value)} onChange={() => toggleCategory(option.value)} />)}
                        </fieldset>
                        <fieldset>
                            <legend className="mb-4 text-sm font-semibold">Price range</legend>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="minPrice" className="mb-2 text-xs text-[#73776e]">Minimum</Label>
                                    <Input id="minPrice" type="number" min="0" placeholder="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} className="h-10 border-[#dfe4d6] bg-white shadow-none focus-visible:ring-[#7a8568]/20" />
                                </div>
                                <div>
                                    <Label htmlFor="maxPrice" className="mb-2 text-xs text-[#73776e]">Maximum</Label>
                                    <Input id="maxPrice" type="number" min="0" placeholder="Any" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} className="h-10 border-[#dfe4d6] bg-white shadow-none focus-visible:ring-[#7a8568]/20" />
                                </div>
                            </div>
                        </fieldset>
                        <fieldset>
                            <legend className="mb-3 text-sm font-semibold">Listing type</legend>
                            <FilterOption label="Traditional" checked={listingType === "TRADITIONAL"} onChange={() => setListingType(listingType === "TRADITIONAL" ? ALL : "TRADITIONAL")} />
                            <FilterOption label="Blockchain" checked={listingType === "BLOCKCHAIN"} onChange={() => setListingType(listingType === "BLOCKCHAIN" ? ALL : "BLOCKCHAIN")} />
                        </fieldset>
                        <fieldset>
                            <legend className="mb-3 text-sm font-semibold">Creation source</legend>
                            <FilterOption label="AI-generated" checked={aiFilter === "AI"} onChange={() => setAiFilter(aiFilter === "AI" ? ALL : "AI")} />
                            <FilterOption label="Human-made" checked={aiFilter === "HUMAN"} onChange={() => setAiFilter(aiFilter === "HUMAN" ? ALL : "HUMAN")} />
                        </fieldset>
                        {imagesSelected && <AdvancedFilters category="Images">
                            <fieldset>
                                <legend className="mb-2 text-xs font-medium text-[#555e49]">Orientation</legend>
                                {ORIENTATION_OPTIONS.map((option) => <FilterOption key={option.value} label={option.label} checked={orientations.some((selected) => selected.value === option.value)} onChange={() => toggleMultiParam("imageOrientation", option.value)} />)}
                            </fieldset>
                            <div>
                                <Label htmlFor="image-resolution" className="mb-2 text-xs font-medium text-[#555e49]">Minimum resolution</Label>
                                <Select value={resolution} onValueChange={(value) => setBrowseParam("imageMinResolution", value)}>
                                    <SelectTrigger id="image-resolution" className="h-10 w-full border-[#dfe4d6] bg-white text-xs focus-visible:ring-[#7a8568]/20"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-[#fcfcfa] text-[#252823]">
                                        <SelectItem value={ALL}>Any resolution</SelectItem>
                                        <SelectItem value="1920">HD — 1920px+</SelectItem>
                                        <SelectItem value="3840">4K — 3840px+</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="mt-2 text-[11px] leading-4 text-[#85897f]">Measured by the longest side.</p>
                            </div>
                            <fieldset>
                                <legend className="mb-2 text-xs font-medium text-[#555e49]">File format</legend>
                                {IMAGE_FORMATS.map((option) => <FilterOption key={option.value} label={option.label} checked={imageFormats.some((selected) => selected.value === option.value)} onChange={() => toggleMultiParam("imageFormat", option.value)} />)}
                            </fieldset>
                        </AdvancedFilters>}
                        {animationsSelected && <AdvancedFilters category="Animations">
                            <fieldset>
                                <legend className="mb-2 text-xs font-medium text-[#555e49]">Download file format</legend>
                                {ANIMATION_FORMATS.map((option) => <FilterOption key={option.value} label={option.label} checked={animationFormats.some((selected) => selected.value === option.value)} onChange={() => toggleMultiParam("animationFormat", option.value)} />)}
                            </fieldset>
                        </AdvancedFilters>}
                        {modelsSelected && <AdvancedFilters category="3D models">
                            <fieldset>
                                <legend className="mb-2 text-xs font-medium text-[#555e49]">File format</legend>
                                {MODEL_FORMATS.map((option) => <FilterOption key={option.value} label={option.label} checked={modelFormats.some((selected) => selected.value === option.value)} onChange={() => toggleMultiParam("modelFormat", option.value)} />)}
                            </fieldset>
                        </AdvancedFilters>}
                        {fontsSelected && <AdvancedFilters category="Fonts">
                            <fieldset>
                                <legend className="mb-2 text-xs font-medium text-[#555e49]">File format</legend>
                                {FONT_FORMATS.map((option) => <FilterOption key={option.value} label={option.label} checked={fontFormats.some((selected) => selected.value === option.value)} onChange={() => toggleMultiParam("fontFormat", option.value)} />)}
                            </fieldset>
                        </AdvancedFilters>}
                        {audioSelected && <AdvancedFilters category="Audio">
                            <fieldset>
                                <legend className="mb-2 text-xs font-medium text-[#555e49]">Audio type</legend>
                                {AUDIO_TYPES.map((option) => <FilterOption key={option.value} label={option.label} checked={audioTypes.some((selected) => selected.value === option.value)} onChange={() => toggleMultiParam("audioType", option.value)} />)}
                            </fieldset>
                            <fieldset>
                                <legend className="mb-2 text-xs font-medium text-[#555e49]">File format</legend>
                                {AUDIO_FORMATS.map((option) => <FilterOption key={option.value} label={option.label} checked={audioFormats.some((selected) => selected.value === option.value)} onChange={() => toggleMultiParam("audioFormat", option.value)} />)}
                            </fieldset>
                            <fieldset>
                                <legend className="mb-3 text-xs font-medium text-[#555e49]">Duration (seconds)</legend>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label htmlFor="audio-min-duration" className="mb-2 text-xs text-[#73776e]">Minimum</Label>
                                        <Input id="audio-min-duration" type="number" min="0" step="any" placeholder="0" value={audioMinDuration} onChange={(event) => setBrowseParam("audioMinDuration", event.target.value)} className="h-10 border-[#dfe4d6] bg-white shadow-none focus-visible:ring-[#7a8568]/20" />
                                    </div>
                                    <div>
                                        <Label htmlFor="audio-max-duration" className="mb-2 text-xs text-[#73776e]">Maximum</Label>
                                        <Input id="audio-max-duration" type="number" min="0" step="any" placeholder="Any" value={audioMaxDuration} onChange={(event) => setBrowseParam("audioMaxDuration", event.target.value)} className="h-10 border-[#dfe4d6] bg-white shadow-none focus-visible:ring-[#7a8568]/20" />
                                    </div>
                                </div>
                                {audioMinDuration !== "" && audioMaxDuration !== "" && Number(audioMinDuration) > Number(audioMaxDuration) && <p className="mt-2 text-xs text-destructive">Maximum must be at least the minimum.</p>}
                            </fieldset>
                        </AdvancedFilters>}
                        {videosSelected && <AdvancedFilters category="Videos">
                            <fieldset>
                                <legend className="mb-2 text-xs font-medium text-[#555e49]">Orientation</legend>
                                {ORIENTATION_OPTIONS.map((option) => <FilterOption key={option.value} label={option.label} checked={videoOrientations.some((selected) => selected.value === option.value)} onChange={() => toggleMultiParam("videoOrientation", option.value)} />)}
                            </fieldset>
                            <div>
                                <Label htmlFor="video-resolution" className="mb-2 text-xs font-medium text-[#555e49]">Minimum resolution</Label>
                                <Select value={videoResolution} onValueChange={(value) => setBrowseParam("videoMinResolution", value)}>
                                    <SelectTrigger id="video-resolution" className="h-10 w-full border-[#dfe4d6] bg-white text-xs focus-visible:ring-[#7a8568]/20"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-[#fcfcfa] text-[#252823]">
                                        <SelectItem value={ALL}>Any resolution</SelectItem>
                                        {VIDEO_RESOLUTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <p className="mt-2 text-[11px] leading-4 text-[#85897f]">Measured by the shorter side.</p>
                            </div>
                            <fieldset>
                                <legend className="mb-2 text-xs font-medium text-[#555e49]">File format</legend>
                                {VIDEO_FORMATS.map((option) => <FilterOption key={option.value} label={option.label} checked={videoFormats.some((selected) => selected.value === option.value)} onChange={() => toggleMultiParam("videoFormat", option.value)} />)}
                            </fieldset>
                            <fieldset>
                                <legend className="mb-3 text-xs font-medium text-[#555e49]">Duration (seconds)</legend>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label htmlFor="video-min-duration" className="mb-2 text-xs text-[#73776e]">Minimum</Label>
                                        <Input id="video-min-duration" type="number" min="0" step="any" placeholder="0" value={minDuration} onChange={(event) => setBrowseParam("videoMinDuration", event.target.value)} className="h-10 border-[#dfe4d6] bg-white shadow-none focus-visible:ring-[#7a8568]/20" />
                                    </div>
                                    <div>
                                        <Label htmlFor="video-max-duration" className="mb-2 text-xs text-[#73776e]">Maximum</Label>
                                        <Input id="video-max-duration" type="number" min="0" step="any" placeholder="Any" value={maxDuration} onChange={(event) => setBrowseParam("videoMaxDuration", event.target.value)} className="h-10 border-[#dfe4d6] bg-white shadow-none focus-visible:ring-[#7a8568]/20" />
                                    </div>
                                </div>
                                {minDuration !== "" && maxDuration !== "" && Number(minDuration) > Number(maxDuration) && <p className="mt-2 text-xs text-destructive">Maximum must be at least the minimum.</p>}
                            </fieldset>
                            <div>
                                <Label htmlFor="video-frame-rate" className="mb-2 text-xs font-medium text-[#555e49]">Minimum frame rate</Label>
                                <Select value={frameRate} onValueChange={(value) => setBrowseParam("videoMinFrameRate", value)}>
                                    <SelectTrigger id="video-frame-rate" className="h-10 w-full border-[#dfe4d6] bg-white text-xs focus-visible:ring-[#7a8568]/20"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-[#fcfcfa] text-[#252823]">
                                        <SelectItem value={ALL}>Any frame rate</SelectItem>
                                        {["24", "30", "60"].map((value) => <SelectItem key={value} value={value}>{value} fps+</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </AdvancedFilters>}
                    </div>
                </aside>

                <div className="min-w-0">
                    <div aria-label="Active filters" className="flex min-h-[77px] flex-wrap items-center gap-2 border-b border-[#e7e9e1] px-5 py-4 sm:px-8 lg:px-10">
                        <span className="mr-2 text-[10px] font-semibold tracking-[0.12em] text-[#73776e]">ACTIVE FILTERS</span>
                        {activeFilters.length ? activeFilters.map((filter) => (
                            <button key={filter.key} type="button" onClick={filter.remove} aria-label={`Remove filter: ${filter.label}`} className={cn("inline-flex max-w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors motion-reduce:transition-none", filter.key === "keyword" ? "bg-[#657152] text-white hover:bg-[#555e49]" : "bg-[#e3e8d8] text-[#555e49] hover:bg-[#d8dfcc]", FOCUS)}>
                                <span className="truncate">{filter.label}</span><X className="size-3.5 shrink-0" aria-hidden="true" />
                            </button>
                        )) : <span className="text-xs text-[#85897f]">All creative assets</span>}
                        {activeFilters.length > 0 && <button type="button" onClick={clearFilters} className={cn("ml-2 rounded-sm border-l border-[#dfe4d6] pl-4 text-xs font-medium text-[#657152] hover:underline", FOCUS)}>Clear all</button>}
                    </div>

                    <section aria-label="Marketplace assets" className="px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
                        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-[#73776e]">
                            <Link to="/" className={cn("rounded-sm hover:text-[#30392b]", FOCUS)}>Home</Link>
                            <ChevronRight className="size-3" aria-hidden="true" />
                            <span aria-current="page">Marketplace</span>
                        </nav>
                        <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div role="search" aria-label="Search marketplace" className="flex w-full items-center gap-2 rounded-xl border border-[#dfe4d6] bg-white px-3 focus-within:border-[#7a8568] focus-within:ring-3 focus-within:ring-[#7a8568]/20 xl:max-w-[420px]">
                                <Search className="size-4 shrink-0 text-[#85897f]" aria-hidden="true" />
                                <Input type="search" placeholder="Search creative assets…" value={keyword} onChange={(event) => setBrowseParam("keyword", event.target.value)} aria-label="Search marketplace assets" className="h-11 min-w-0 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" />
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                                <span id="sort-label" className="text-[10px] font-semibold tracking-[0.12em] text-[#73776e]">SORT BY</span>
                                <Select value={sort} onValueChange={(value) => setBrowseParam("sort", value)}>
                                    <SelectTrigger aria-labelledby="sort-label" className="h-11 w-[190px] border-[#dfe4d6] bg-[#fcfcfa] px-4 text-xs text-[#555e49] focus-visible:ring-[#7a8568]/20"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-[#fcfcfa] text-[#252823]">{SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-10">
                            {selectedCategories.length > 0 ? selectedCategories.map((option) => (
                                <CategoryResults
                                    key={`${option.value}:${filterKey}:${option.value === "IMAGE" ? imageFilterKey : option.value === "VIDEO" ? videoFilterKey : option.value === "SOUND_EFFECT" ? audioFilterKey : option.value === "FONT" ? fontFilterKey : option.value === "THREE_D_MODEL" ? modelFilterKey : option.value === "ANIMATION" ? animationFilterKey : ""}`}
                                    title={option.label}
                                    params={{ ...params, category: option.value, ...(option.value === "IMAGE" ? imageParams : option.value === "VIDEO" ? videoParams : option.value === "SOUND_EFFECT" ? audioParams : option.value === "FONT" ? fontParams : option.value === "THREE_D_MODEL" ? modelParams : option.value === "ANIMATION" ? animationParams : {}) }}
                                    onClearFilters={clearFilters}
                                    hasFilters={activeFilters.length > 0}
                                />
                            )) : (
                                <CategoryResults key={filterKey} params={params} onClearFilters={clearFilters} hasFilters={activeFilters.length > 0} />
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}

function CategoryResults({ params, title, onClearFilters, hasFilters }: {
    params: BrowseAssetsParams;
    title?: string;
    onClearFilters: () => void;
    hasFilters: boolean;
}) {
    const [page, setPage] = useState(1);
    const { data, isLoading, error, refetch } = useBrowseAssets({ ...params, page });
    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
    const pageNumbers = Array.from(new Set([1, page - 1, page, page + 1, totalPages]))
        .filter((number) => number >= 1 && number <= totalPages).sort((a, b) => a - b);

    return (
        <section aria-label={title ?? "All marketplace results"}>
            {title && <h2 className="mb-4 border-b border-[#e7e9e1] pb-3 text-xl font-semibold tracking-[-0.03em] text-[#30392b]">{title}</h2>}
            <div aria-live="polite" aria-atomic="true" className="mb-4 text-xs text-[#85897f]">
                {isLoading ? "Finding creative assets…" : error ? "Assets are currently unavailable" : data ? `${data.total.toLocaleString()} ${data.total === 1 ? "asset" : "assets"} to explore` : ""}
            </div>
            {isLoading && <div aria-hidden="true" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-xl border border-[#e7e9e1] bg-white">
                    <div className="aspect-[4/3] animate-pulse bg-[#e9ecdf] motion-reduce:animate-none" />
                    <div className="space-y-3 p-4"><div className="h-3 w-3/4 animate-pulse rounded bg-[#e9ecdf] motion-reduce:animate-none" /><div className="h-3 w-1/2 animate-pulse rounded bg-[#e9ecdf] motion-reduce:animate-none" /></div>
                </div>
            ))}</div>}
            {error && <div role="alert" className="rounded-xl border border-[#dfe4d6] bg-[#fcfcfa] px-6 py-12 text-center">
                <h2 className="text-lg font-medium">We couldn’t load the assets.</h2><p className="mt-2 text-sm text-[#73776e]">Please try again in a moment.</p>
                <Button onClick={() => void refetch()} className="mt-5 bg-[#30392b] text-white hover:bg-[#444f3a]">Try again</Button>
            </div>}
            {data && !error && data.items.length === 0 && <div className="rounded-xl border border-dashed border-[#c5cfb5] px-6 py-16 text-center">
                <Search className="mx-auto mb-4 size-7 text-[#7a8568]" aria-hidden="true" /><h2 className="text-lg font-medium">No assets found</h2>
                <p className="mt-2 text-sm text-[#73776e]">Try a different search or adjust your filters.</p>
                {hasFilters && <Button onClick={onClearFilters} className="mt-5 bg-[#30392b] text-white hover:bg-[#444f3a]">Clear filters</Button>}
            </div>}
            {data && !error && data.items.length > 0 && <>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{data.items.map((asset) => asset.category === "SOUND_EFFECT" ? <AudioAssetRow key={asset.id} asset={asset} /> : asset.category === "FONT" ? <FontAssetRow key={asset.id} asset={asset} /> : <AssetCard key={asset.id} asset={asset} variant="compact" />)}</div>
                <div className="mt-12 border-t border-[#e7e9e1] pt-8">
                    {totalPages > 1 && <nav aria-label={title ? `${title} pagination` : "Marketplace pagination"} className="flex items-center justify-center gap-2">
                        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)} className={cn("flex size-10 items-center justify-center rounded-lg bg-[#eceee7] text-[#555e49] hover:bg-[#e3e8d8] disabled:cursor-not-allowed disabled:opacity-40", FOCUS)}><ChevronLeft className="size-4" aria-hidden="true" /></button>
                        {pageNumbers.map((number, index) => <span key={number} className="flex items-center gap-2">
                            {index > 0 && number - pageNumbers[index - 1] > 1 && <span className="px-1 text-[#85897f]">…</span>}
                            <button type="button" aria-label={`Page ${number}`} aria-current={number === page ? "page" : undefined} onClick={() => setPage(number)} className={cn("size-10 rounded-lg text-sm font-medium", number === page ? "bg-[#657152] text-white shadow-sm" : "border border-[#e7e9e1] bg-[#fcfcfa] text-[#555e49] hover:bg-[#e3e8d8]", FOCUS)}>{number}</button>
                        </span>)}
                        <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={cn("flex size-10 items-center justify-center rounded-lg bg-[#eceee7] text-[#555e49] hover:bg-[#e3e8d8] disabled:cursor-not-allowed disabled:opacity-40", FOCUS)}><ChevronRight className="size-4" aria-hidden="true" /></button>
                    </nav>}
                    <p className="mt-5 text-center text-xs text-[#85897f]">Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total.toLocaleString()} results</p>
                </div>
            </>}
        </section>
    );
}
