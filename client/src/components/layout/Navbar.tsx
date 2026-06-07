import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import NotificationBell from './NotificationBell';
import CurrencySwitcher from './CurrencySwitcher';

export default function Navbar() {
    const { user, logout } = useAuth();
    const { data: profile } = useProfile();

    return (
        <nav className="flex items-center justify-between border-b px-6 py-3">
            <div className="flex items-center gap-6">
                <Link to="/" className="text-lg font-semibold">
                    PasarPixel
                </Link>
                <Link
                    to="/marketplace"
                    className="text-sm text-muted-foreground hover:text-foreground"
                >
                    Marketplace
                </Link>
                {user && (
                    <Link
                        to="/dashboard"
                        className="text-sm text-muted-foreground hover:text-foreground"
                    >
                        Dashboard
                    </Link>
                )}
                <Link
                    to="/verify"
                    className="text-sm text-muted-foreground hover:text-foreground"
                >
                    Verify
                </Link>
            </div>

            <div className="flex items-center gap-2">
                <CurrencySwitcher />
                {user ? (
                    <>
                        {user.roles.includes("BUYER") && (
                            <>
                                <Link
                                    to="/orders"
                                    className="text-sm text-muted-foreground hover:text-foreground"
                                >
                                    Orders
                                </Link>
                                <Link
                                    to="/cart"
                                    className="text-sm text-muted-foreground hover:text-foreground"
                                >
                                    Cart
                                </Link>
                            </>
                        )}
                        <NotificationBell />
                        <Link
                            to="/settings"
                            className="text-sm text-muted-foreground hover:text-foreground"
                        >
                            Settings
                        </Link>
                        <Link
                            to="/profile"
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:underline"
                        >
                            <Avatar size="sm">
                                {profile?.avatarUrl && (
                                    <AvatarImage src={profile.avatarUrl} alt={user.email} />
                                )}
                                <AvatarFallback>
                                    {(profile?.name ?? user.email).charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            {user.email}
                        </Link>
                        <Button variant="outline" size="sm" onClick={logout}>
                            Logout
                        </Button>
                    </>
                ) : (
                    <>
                        <Link to="/login">
                            <Button variant="ghost" size="sm">Login</Button>
                        </Link>
                        <Link to="/register">
                            <Button size="sm">Register</Button>
                        </Link>
                    </>
                )}
            </div>
        </nav>
    );
}
