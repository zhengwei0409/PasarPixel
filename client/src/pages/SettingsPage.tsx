import TwoFactorSection from "@/components/settings/TwoFactorSection";
import FloatingShapes from "@/components/home/FloatingShapes";

export default function SettingsPage() {
    return (
        <main className="settings-theme relative isolate min-h-[calc(100dvh-73px)] bg-[#f7f7f2] text-[#252823]">
            <FloatingShapes />
            <div className="relative z-10 mx-auto max-w-[1104px] px-4 py-10 sm:px-8 sm:py-16 lg:px-12">
                <TwoFactorSection />
            </div>
        </main>
    );
}
