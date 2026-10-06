import { useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Collapsible } from 'radix-ui';
import { Menu, ShoppingBag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { cn } from '@/lib/utils';
import AccountMenu from './AccountMenu';
import NotificationBell from './NotificationBell';
import CurrencySwitcher from './CurrencySwitcher';
import logo from '@/assets/pasarpixel-logo.jpeg';

export default function Navbar() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [menuLocation, setMenuLocation] = useState<string | null>(null);
    const menuTriggerRef = useRef<HTMLButtonElement>(null);
    const menuOpen = menuLocation === location.key;
    const isBuyer = user?.roles.includes('BUYER');
    const canViewDashboard = user?.roles.some((role) => role === 'SELLER' || role === 'ADMIN');
    const { data: cart } = useCart(!!isBuyer);
    const cartCount = isBuyer ? (cart?.items.length ?? 0) : 0;
    const cartLabel = cartCount > 0 ? `Shopping cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}` : 'Shopping cart';
    const cartBadge = cartCount > 9 ? '9+' : String(cartCount);
    const links = [
        { to: '/marketplace', label: 'Marketplace' },
        ...(canViewDashboard ? [{ to: '/dashboard', label: 'Dashboard' }] : []),
        { to: '/verify', label: 'Verify a license' },
    ];

    return (
        <Collapsible.Root
            asChild
            open={menuOpen}
            onOpenChange={(open) => setMenuLocation(open ? location.key : null)}
        >
            <header className="sticky top-0 z-40 border-b border-[#e7e9e1] bg-[#fcfcfa]/95 text-[#252823] backdrop-blur-xl">
                <div className="mx-auto flex h-18 max-w-[1296px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
                    <div className="flex min-w-0 items-center gap-10">
                        <Link to="/" aria-label="PasarPixel home" className="group flex shrink-0 items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568]">
                            <svg
                                viewBox="600 236 336 344"
                                className="size-6 transition-transform duration-300 group-hover:-rotate-6 motion-reduce:transition-none"
                                aria-hidden="true"
                            >
                                <defs>
                                    <filter id="navbar-logo-theme" colorInterpolationFilters="sRGB">
                                        <feColorMatrix
                                            in="SourceGraphic"
                                            type="matrix"
                                            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -0.26575 -0.894 -0.09025 0 1.25"
                                            result="logoMask"
                                        />
                                        <feFlood floodColor="#30392b" />
                                        <feComposite in2="logoMask" operator="in" />
                                    </filter>
                                </defs>
                                <image href={logo} width="1536" height="1024" filter="url(#navbar-logo-theme)" />
                            </svg>
                            <span className="text-lg font-semibold tracking-[-0.045em]">Pasar<span className="font-normal text-[#657152]">Pixel</span></span>
                        </Link>

                        <nav aria-label="Main navigation" className="hidden h-18 items-center gap-7 lg:flex">
                            {links.map(({ to, label }) => (
                                <NavLink
                                    key={to}
                                    to={to}
                                    className={({ isActive }) => cn(
                                        'relative flex h-full items-center rounded-sm text-sm transition-colors duration-200 after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-[#7a8568] after:transition-transform after:duration-200 hover:text-[#30392b] hover:after:scale-x-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7a8568] motion-reduce:transition-none motion-reduce:after:transition-none',
                                        isActive ? 'font-medium text-[#30392b] after:scale-x-100' : 'text-[#73776e]',
                                    )}
                                >
                                    {label}
                                </NavLink>
                            ))}
                        </nav>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 sm:gap-3">
                        <div className="hidden sm:block"><CurrencySwitcher /></div>
                        <div aria-hidden="true" className="mx-1 hidden h-5 w-px bg-[#e2e5dc] sm:block" />
                        {user ? (
                            <>
                                {isBuyer && (
                                    <Button asChild variant="ghost" size="icon" className="relative hidden size-10 rounded-full text-[#657152] hover:bg-[#eef0e7] hover:text-[#30392b] motion-reduce:transition-none sm:inline-flex">
                                        <NavLink to="/cart" aria-label={cartLabel}>
                                            <ShoppingBag className="size-[18px]" aria-hidden="true" />
                                            {cartCount > 0 && (
                                                <span aria-hidden="true" className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#657152] px-1 text-[9px] font-medium text-white ring-2 ring-[#fcfcfa]">
                                                    {cartBadge}
                                                </span>
                                            )}
                                        </NavLink>
                                    </Button>
                                )}
                                <NotificationBell />
                                <AccountMenu email={user.email} isBuyer={!!isBuyer} logout={logout} />
                            </>
                        ) : (
                            <>
                                <Button asChild variant="ghost" className="h-10 px-3 text-xs font-medium text-[#555e49] hover:bg-[#eef0e7] hover:text-[#30392b] motion-reduce:transition-none sm:text-sm">
                                    <Link to="/login">Sign in</Link>
                                </Button>
                                <Button asChild className="hidden h-10 rounded-lg bg-[#30392b] px-4 text-sm font-medium text-white hover:bg-[#444f3a] motion-reduce:transition-none sm:inline-flex">
                                    <Link to="/register">Create account</Link>
                                </Button>
                            </>
                        )}
                        <Collapsible.Trigger asChild>
                            <Button ref={menuTriggerRef} variant="ghost" size="icon" className="size-10 text-[#555e49] hover:bg-[#eef0e7] motion-reduce:transition-none lg:hidden" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}>
                                {menuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
                            </Button>
                        </Collapsible.Trigger>
                    </div>
                </div>

                <Collapsible.Content
                    className="border-t border-[#e7e9e1] bg-[#fcfcfa] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 data-[state=open]:duration-200 motion-reduce:animate-none lg:hidden"
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            setMenuLocation(null);
                            menuTriggerRef.current?.focus();
                        }
                    }}
                >
                    <nav aria-label="Mobile navigation" className="mx-auto max-w-[1296px] space-y-1 px-4 py-4 sm:px-8">
                        {[...links, ...(isBuyer ? [{ to: '/cart', label: 'Shopping cart' }] : [])].map(({ to, label }) => (
                            <NavLink key={to} to={to} aria-label={to === '/cart' ? cartLabel : undefined} onClick={() => setMenuLocation(null)} className={({ isActive }) => cn(
                                'flex items-center justify-between rounded-lg px-3 py-3 text-sm transition-colors hover:bg-[#eef0e7] focus-visible:outline-2 focus-visible:outline-[#7a8568] motion-reduce:transition-none',
                                isActive ? 'bg-[#eef0e7] font-medium text-[#30392b]' : 'text-[#73776e]',
                            )}>
                                {label}
                                {to === '/cart' && cartCount > 0 && (
                                    <span aria-hidden="true" className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#657152] px-1 text-[9px] font-medium text-white">
                                        {cartBadge}
                                    </span>
                                )}
                            </NavLink>
                        ))}
                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#e7e9e1] px-3 pt-4 sm:hidden">
                            <CurrencySwitcher />
                            {!user && (
                                <Button asChild className="h-10 bg-[#30392b] text-white hover:bg-[#444f3a] motion-reduce:transition-none">
                                    <Link to="/register" onClick={() => setMenuLocation(null)}>Create account</Link>
                                </Button>
                            )}
                        </div>
                    </nav>
                </Collapsible.Content>
            </header>
        </Collapsible.Root>
    );
}
