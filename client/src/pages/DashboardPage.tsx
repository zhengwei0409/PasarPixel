import { Link } from "react-router-dom";
import { Package, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../hooks/useAuth";
import { useSyncRoles } from "../hooks/useSyncRoles";
import SellerDashboardSection from "../components/SellerDashboardSection";
import RoleChangeLogSection from "../components/RoleChangeLogSection";
import AssetReviewLogSection from "../components/AssetReviewLogSection";
import DashboardStatsSection from "../components/DashboardStatsSection";

export default function DashboardPage() {
    const { user } = useAuth();
    const { newRoles } = useSyncRoles();
    const isSeller = user?.roles.includes("SELLER");
    const isAdmin = user?.roles.includes("ADMIN");

    return (
        <div className={isSeller ? "seller-dashboard-theme min-h-screen bg-background px-4 py-8 text-foreground sm:px-8 sm:py-10" : "min-h-screen p-8"}>
            <div className={`mx-auto space-y-6 ${isSeller ? "max-w-[1200px]" : "max-w-3xl"}`}>
                {newRoles && (
                    <div className="flex items-center justify-between gap-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
                        <p className="text-sm text-blue-800">
                            Your account was upgraded — new access: <span className="font-medium">{newRoles.join(", ")}</span>.
                            Reload to unlock these features.
                        </p>
                        <Button size="sm" onClick={() => window.location.reload()}>
                            Reload
                        </Button>
                    </div>
                )}

                <header className="flex flex-wrap items-center justify-between gap-5 pb-2">
                    <div>
                        {isSeller && <p className="mb-2 text-[10px] font-medium tracking-[0.2em] text-muted-foreground">YOUR CREATIVE BUSINESS</p>}
                        <h1 className={isSeller ? "text-3xl font-semibold tracking-[-0.04em] sm:text-4xl" : "text-2xl font-bold"}>
                            {isSeller ? "Seller dashboard" : "Dashboard"}
                        </h1>
                        <p className="mt-2 break-all text-xs text-muted-foreground">
                            Logged in as <span className="font-medium">{user?.email}</span>
                            {user?.roles.length ? ` · ${user.roles.join(", ")}` : ""}
                        </p>
                    </div>
                    {isSeller && (
                        <div className="flex flex-wrap gap-3">
                            <Button asChild variant="secondary" className="h-11 gap-2 border-[#c5cfb5] bg-[#e3e8d8] px-5 text-[#425137] hover:bg-[#d8dfca]">
                                <Link to="/seller/listings"><Package className="size-4" aria-hidden="true" />My Listings</Link>
                            </Button>
                            <Button asChild className="h-11 gap-2 px-5">
                                <Link to="/seller/upload"><Plus className="size-4" aria-hidden="true" />Upload New Asset</Link>
                            </Button>
                        </div>
                    )}
                </header>

                {isSeller && <SellerDashboardSection />}

                {(!isSeller || isAdmin) && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {!isAdmin && !isSeller && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Become a Seller</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <p className="text-sm text-muted-foreground">
                                        Apply for seller access or check the status of your application.
                                    </p>
                                    <Button asChild className="w-full">
                                        <Link to="/seller-application">Seller Application</Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {!isSeller && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Profile</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <p className="text-sm text-muted-foreground">
                                        Update your profile details.
                                    </p>
                                    <Button asChild variant="outline" className="w-full">
                                        <Link to="/profile">Edit Profile</Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {isAdmin && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Admin</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <p className="text-sm text-muted-foreground">
                                        Review pending seller applications and asset uploads.
                                    </p>
                                    <Button asChild variant="outline" className="w-full">
                                        <Link to="/admin/applications">Seller Applications</Link>
                                    </Button>
                                    <Button asChild variant="outline" className="w-full">
                                        <Link to="/admin/assets/pending">Pending Asset Reviews</Link>
                                    </Button>
                                    <Button asChild variant="outline" className="w-full">
                                        <Link to="/admin/sellers">Manage Sellers</Link>
                                    </Button>
                                    <Button asChild variant="outline" className="w-full">
                                        <Link to="/admin/users">Manage Users</Link>
                                    </Button>
                                    <Button asChild variant="outline" className="w-full">
                                        <Link to="/admin/reports">Reported Listings</Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                {isAdmin && <DashboardStatsSection />}

                {isAdmin && <RoleChangeLogSection />}

                {isAdmin && <AssetReviewLogSection />}
            </div>
        </div>
    );
}
