import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import NotificationBell from './NotificationBell';

export default function Navbar() {
    const { user, logout } = useAuth();

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
            </div>

            <div className="flex items-center gap-2">
                {user ? (
                    <>
                        <NotificationBell />
                        <Link
                            to="/profile"
                            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                        >
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
