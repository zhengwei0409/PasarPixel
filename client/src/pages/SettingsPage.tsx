import TwoFactorSection from "@/components/settings/TwoFactorSection";
import FloatingShapes from "@/components/home/FloatingShapes";
import ChangePasswordSection from "@/components/settings/ChangePasswordSection";
import WalletSection from "@/components/settings/WalletSection";
import SellerStripePayments from "@/components/SellerStripePayments";
import { useAuth } from "@/hooks/useAuth";

export default function SettingsPage() {
    const { user } = useAuth();

    return (
        <main className="settings-theme relative isolate min-h-[calc(100dvh-73px)] bg-[#f7f7f2] text-[#252823]">
            <FloatingShapes />
            <div className="relative z-10 mx-auto max-w-[1104px] space-y-6 px-4 py-10 sm:px-8 sm:py-16 lg:px-12">
                {user?.roles.includes("SELLER") && <SellerStripePayments />}
                <TwoFactorSection />
                <ChangePasswordSection />
                <WalletSection />
            </div>
        </main>
    );
}
