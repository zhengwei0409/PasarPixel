import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Box, Film, ImageIcon, Layers, Music2, Search, Sparkles, Type } from "lucide-react";
import AssetSection from "@/components/home/AssetSection";
import FloatingShapes from "@/components/home/FloatingShapes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AssetCategory } from "@/types/asset";

const CATEGORIES = [
    { value: "ALL", label: "All assets", icon: Layers },
    { value: "THREE_D_MODEL", label: "3D models", icon: Box },
    { value: "IMAGE", label: "Images", icon: ImageIcon },
    { value: "VIDEO", label: "Videos", icon: Film },
    { value: "SOUND_EFFECT", label: "Audio", icon: Music2 },
    { value: "FONT", label: "Fonts", icon: Type },
    { value: "ANIMATION", label: "Animations", icon: Sparkles },
] satisfies { value: AssetCategory | "ALL"; label: string; icon: typeof Search }[];

export default function HomePage() {
    const navigate = useNavigate();
    const [keyword, setKeyword] = useState("");
    const [category, setCategory] = useState<AssetCategory | "ALL">("ALL");

    return (
        <main className="relative isolate min-h-[calc(100dvh-73px)] bg-[#f7f7f2] text-[#252823]">
            <FloatingShapes />
            <section aria-labelledby="home-heading" className="relative z-10 overflow-hidden border-b border-[#e7e9e1] px-4 pt-16 pb-16 sm:px-8 sm:pt-24 sm:pb-20">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,#e3e8d8_0%,transparent_65%)]" />
                <div className="relative mx-auto max-w-[960px] text-center">
                    <p className="mb-5 text-[10px] font-medium tracking-[0.22em] text-[#74796c]">GOOD IDEAS START WITH A GREAT FIND</p>
                    <h1 id="home-heading" className="text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[1.07] font-semibold tracking-[-0.055em]">
                        Find your next<br /><span className="font-normal text-[#7a8568] italic">creative asset.</span>
                    </h1>
                    <p className="mx-auto mt-6 max-w-[440px] text-sm leading-6 text-[#73776e] sm:text-base sm:leading-7">
                        From the first spark to the finishing touch.<br className="hidden sm:block" /> Discover assets that bring your ideas to life.
                    </p>

                    <form
                        role="search"
                        aria-label="Find creative assets"
                        className="mx-auto mt-9 flex max-w-[600px] items-center gap-2 rounded-xl border border-[#dfe4d6] bg-white p-2 shadow-[0_8px_24px_-16px_rgba(37,40,35,0.2)]"
                        onSubmit={(event) => {
                            event.preventDefault();
                            const params = new URLSearchParams();
                            if (keyword.trim()) params.set("keyword", keyword.trim());
                            if (category !== "ALL") params.set("category", category);
                            navigate(`/marketplace${params.size ? `?${params.toString()}` : ""}`);
                        }}
                    >
                        <Search className="ml-2 size-[18px] shrink-0 text-[#85897f]" aria-hidden="true" />
                        <Input type="search" aria-label="Search assets" placeholder="Search for models, images, sounds…" value={keyword} onChange={(event) => setKeyword(event.target.value)} className="h-10 min-w-0 rounded-md border-0 bg-transparent px-1 shadow-none placeholder:text-[#a0a499] focus-visible:ring-[#7a8568]/20" />
                        <Button type="submit" className="h-10 rounded-lg bg-[#30392b] px-4 text-xs font-medium text-white hover:bg-[#444f3a] motion-reduce:transition-none sm:px-6 sm:text-sm">Search</Button>
                    </form>

                    <div className="mx-auto mt-4 flex flex-nowrap gap-2 overflow-x-auto px-1 py-1" role="group" aria-label="Search category">
                        {CATEGORIES.map(({ value, label, icon: Icon }) => (
                            <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)} className={cn(
                                "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-colors first:ml-auto last:mr-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a8568] motion-reduce:transition-none",
                                category === value ? "border-[#657152] bg-[#657152] text-white" : "border-transparent bg-[#eceee7] text-[#73776e] hover:border-[#c5cfb5] hover:bg-[#e3e8d8] hover:text-[#30392b]",
                            )}><Icon className="size-3" aria-hidden="true" />{label}</button>
                        ))}
                    </div>
                    <p className="mt-6 text-xs text-[#85897f]">A world of possibilities. One place to explore.</p>
                </div>
            </section>

            <div className="relative z-10 mx-auto max-w-[1104px] space-y-16 px-4 py-14 sm:space-y-20 sm:px-8 sm:py-20 lg:px-12">
                <AssetSection title="Trending" eyebrow="COMMUNITY FAVORITES" description="The assets creators keep coming back for." sort="best_selling" layout="grid" limit={4} />
                <AssetSection title="New releases" eyebrow="FRESH ON THE MARKETPLACE" description="Newly uploaded. Ready for your next project." sort="newest" layout="scroller" limit={12} />
            </div>

            <footer className="relative z-10 border-t border-[#e7e9e1] px-4 py-7 sm:px-8">
                <div className="mx-auto flex max-w-[1008px] flex-wrap items-center justify-between gap-4 text-xs text-[#85897f]">
                    <p>PasarPixel <span className="mx-2 text-[#c5cfb5]">/</span> Creative assets. New possibilities.</p>
                    <Link to="/marketplace" className="inline-flex items-center gap-1.5 rounded-sm text-[#657152] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]">Explore the marketplace <ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
                </div>
            </footer>
        </main>
    );
}
