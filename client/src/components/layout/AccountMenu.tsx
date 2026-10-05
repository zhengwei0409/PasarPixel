import { Link } from 'react-router-dom';
import { DropdownMenu } from 'radix-ui';
import { ChevronDown, LogOut, Package, Settings, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/hooks/useProfile';

interface AccountMenuProps {
    email: string;
    isBuyer: boolean;
    logout: () => Promise<void>;
}

export default function AccountMenu({ email, isBuyer, logout }: AccountMenuProps) {
    const { data: profile } = useProfile();
    const name = profile?.name?.trim() || email;
    const itemClass = 'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#555e49] outline-none transition-colors data-[highlighted]:bg-[#eef0e7] data-[highlighted]:text-[#30392b] motion-reduce:transition-none';

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <Button variant="ghost" className="h-10 gap-2 rounded-full px-1 text-[#555e49] hover:bg-[#eef0e7] data-[state=open]:bg-[#eef0e7] motion-reduce:transition-none sm:pr-2" aria-label="Open account menu">
                    <Avatar className="size-8">
                        {profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} alt="" />}
                        <AvatarFallback className="bg-[#e9ecdf] text-xs font-medium text-[#657152]">{name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-28 truncate text-sm font-medium xl:block">{name}</span>
                    <ChevronDown className="hidden size-3.5 sm:block" aria-hidden="true" />
                </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={12} collisionPadding={16} className="z-50 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-[#e7e9e1] bg-[#fcfcfa] p-1.5 shadow-[0_12px_40px_-12px_rgba(37,40,35,0.2)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 data-[state=open]:duration-150 motion-reduce:animate-none">
                    <DropdownMenu.Label className="px-3 py-3">
                        <p className="truncate text-sm font-medium text-[#252823]">{name}</p>
                        <p className="mt-1 truncate text-xs font-normal text-[#73776e]">{email}</p>
                    </DropdownMenu.Label>
                    <DropdownMenu.Separator className="mx-2 mb-1 h-px bg-[#e7e9e1]" />
                    <DropdownMenu.Item asChild className={itemClass}>
                        <Link to="/profile"><UserRound className="size-4" aria-hidden="true" />Your profile</Link>
                    </DropdownMenu.Item>
                    {isBuyer && (
                        <DropdownMenu.Item asChild className={itemClass}>
                            <Link to="/orders"><Package className="size-4" aria-hidden="true" />Purchase history</Link>
                        </DropdownMenu.Item>
                    )}
                    <DropdownMenu.Item asChild className={itemClass}>
                        <Link to="/settings"><Settings className="size-4" aria-hidden="true" />Settings</Link>
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="mx-2 my-1 h-px bg-[#e7e9e1]" />
                    <DropdownMenu.Item className={itemClass} onSelect={() => { void logout(); }}>
                        <LogOut className="size-4" aria-hidden="true" />Sign out
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
