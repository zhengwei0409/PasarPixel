import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../hooks/useAuth";
import { useSyncRoles } from "../hooks/useSyncRoles";
import SellerDashboardSection from "../components/SellerDashboardSection";
import RoleChangeLogSection from "../components/RoleChangeLogSection";

// TODO: This is a prototype UI for testing purposes only. Replace with proper dashboard design in future.
export default function DashboardPage() {
    const { user } = useAuth();
    const { newRoles } = useSyncRoles();
    const isSeller = user?.roles.includes("SELLER");
    const isAdmin = user?.roles.includes("ADMIN");

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-3xl mx-auto space-y-6">
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

                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-sm text-gray-600">
                    Logged in as <span className="font-medium">{user?.email}</span>
                    {user?.roles.length ? ` · ${user.roles.join(", ")}` : ""}
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                    {!isAdmin && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Become a Seller</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <p className="text-sm text-gray-600">
                                    Apply for seller access or check the status of your application.
                                </p>
                                <Button asChild className="w-full">
                                    <Link to="/seller-application">Seller Application</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {isSeller && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Upload Asset</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <p className="text-sm text-gray-600">
                                    Create a new asset listing and upload files.
                                </p>
                                <Button asChild className="w-full">
                                    <Link to="/seller/upload">Upload New Asset</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {isSeller && (
                        <Card>
                            <CardHeader>
                                <CardTitle>My Listings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <p className="text-sm text-gray-600">
                                    View all your assets and their review status.
                                </p>
                                <Button asChild className="w-full">
                                    <Link to="/seller/listings">View My Listings</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Profile</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <p className="text-sm text-gray-600">
                                Update your profile details.
                            </p>
                            <Button asChild variant="outline" className="w-full">
                                <Link to="/profile">Edit Profile</Link>
                            </Button>
                        </CardContent>
                    </Card>

                    {isAdmin && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Admin</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <p className="text-sm text-gray-600">
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
                            </CardContent>
                        </Card>
                    )}
                </div>

                {isSeller && <SellerDashboardSection />}

                {isAdmin && <RoleChangeLogSection />}
            </div>
        </div>
    );
}
