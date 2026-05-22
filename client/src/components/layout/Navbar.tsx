import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
    const { user, logout } = useAuth();

    return (
        <nav className="flex items-center justify-between border-b px-6 py-3">
            <Link to="/" className="text-lg font-semibold">
                PasarPixel
            </Link>

            <div className="flex items-center gap-2">
                {user ? (
                    <>
                        <span className="text-sm text-muted-foreground">
                            {user.email}
                        </span>
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
