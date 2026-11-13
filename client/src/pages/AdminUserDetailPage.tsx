import { useEffect, useRef, useState, type ReactNode } from "react";
import { isAxiosError } from "axios";
import { Link, useLocation, useParams } from "react-router-dom";
import {
    Activity, ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Flag, Loader2, Package,
    ShieldCheck, ShoppingBag, Star, Store, UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { AccountStatusBadge } from "../components/admin/AccountStatusBadge";
import { AccountSuspensionDialog, type SuspensionTarget } from "../components/admin/AccountSuspensionDialog";
import { Button } from "../components/ui/button";
import { SocialLinkIcon } from "../components/profile/SocialLinkIcon";
import { getSocialPlatform } from "../components/profile/socialPlatforms";
import { useUserDetail } from "../hooks/useUsers";
import { useAuth } from "../hooks/useAuth";
import type { AdminUserActivity, AdminUserDetail } from "../../../shared/types/adminUserDetail";

const roleLabels: Record<string, string> = { ADMIN: "Admin", BUYER: "Buyer", SELLER: "Seller" };
const activityIcons = {
    order: ShoppingBag, listing: Package, review: Star, report: Flag,
    application: Store, role: ShieldCheck, admin: UserRound,
};
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function DateText({ value, showTime = false }: { value: string; showTime?: boolean }) {
    return <time dateTime={value}>{(showTime ? timeFormat : dateFormat).format(new Date(value))}</time>;
}

function ProfileField({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
    return (
        <div className={wide ? "col-span-2 min-w-0" : "min-w-0"}>
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words text-sm leading-6">{children || <span className="text-muted-foreground">Not provided</span>}</dd>
        </div>
    );
}

function ActivityRow({ event }: { event: AdminUserActivity }) {
    const Icon = activityIcons[event.kind];
    return (
        <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto]">
            <span className="row-span-2 flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground md:row-span-1">
                <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
                <p className="break-words text-sm font-medium leading-6">{event.title}</p>
                {event.detail && <p className="break-words text-xs leading-5 text-muted-foreground">{event.detail}</p>}
            </div>
            <p className="col-start-2 text-xs leading-6 text-muted-foreground md:col-start-3"><DateText value={event.occurredAt} showTime /></p>
        </li>
    );
}

function ActivityHistory({ userId, firstPage }: { userId: number; firstPage: AdminUserDetail["activity"] }) {
    const [requestedPage, setRequestedPage] = useState(1);
    const heading = useRef<HTMLHeadingElement>(null);
    const { data, isPlaceholderData, error, isFetching, refetch } = useUserDetail(userId, requestedPage);
    const activity = data?.activity;
    const page = activity?.page ?? requestedPage;
    const totalPages = activity?.totalPages ?? firstPage.totalPages;

    function goToPage(nextPage: number) {
        setRequestedPage(nextPage);
        heading.current?.focus({ preventScroll: true });
        heading.current?.scrollIntoView({ block: "nearest" });
    }

    return (
        <>
            <h3 ref={heading} tabIndex={-1} className="mt-6 scroll-mt-24 rounded-sm text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                Recent activity
            </h3>
            {error ? (
                <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    Unable to load this page.
                    <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>Try again</Button>
                </div>
            ) : activity?.recent.length ? (
                <ol aria-busy={isPlaceholderData} className="mt-2 divide-y divide-border">
                    {activity.recent.map((event) => <ActivityRow key={event.id} event={event} />)}
                </ol>
            ) : (
                <div className="mt-4 flex items-center gap-3 rounded-lg bg-secondary/55 px-4 py-5 text-sm text-secondary-foreground">
                    <Activity className="size-4 shrink-0" aria-hidden="true" /> No activity recorded yet.
                </div>
            )}
            {totalPages > 1 && (
                <nav aria-label="Activity pages" className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <span role="status" className="text-xs tabular-nums text-muted-foreground">
                        {isPlaceholderData ? `Loading page ${requestedPage}…` : `Page ${page} of ${totalPages}`}
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" className="h-11" aria-label="Previous activity page" disabled={isPlaceholderData || page <= 1} onClick={() => goToPage(page - 1)}>
                            <ChevronLeft aria-hidden="true" /> Previous
                        </Button>
                        <Button variant="outline" className="h-11" aria-label="Next activity page" disabled={isPlaceholderData || page >= totalPages} onClick={() => goToPage(page + 1)}>
                            Next <ChevronRight aria-hidden="true" />
                        </Button>
                    </div>
                </nav>
            )}
        </>
    );
}

function UserOverview({ data }: { data: AdminUserDetail }) {
    const { account, profile, activity, wallet } = data;
    const name = profile?.name.trim() || account.email;
    const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    const { user } = useAuth();
    const authId = user ? Number(user.sub) : null;
    const currentUserId = authId !== null && Number.isSafeInteger(authId) ? authId : null;
    const [moderationTarget, setModerationTarget] = useState<SuspensionTarget | null>(null);
    const [notice, setNotice] = useState("");
    const moderationButton = useRef<HTMLButtonElement>(null);
    const stats = [
        { label: "Completed orders", value: activity.counts.orders },
        { label: "Listings", value: activity.counts.listings },
        { label: "Reviews written", value: activity.counts.reviews },
        { label: "Reports filed", value: activity.counts.reports },
    ];
    return (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <header className="border-b border-border bg-secondary/65 px-5 py-6 sm:px-8 sm:py-8">
                <div className="flex flex-wrap items-start gap-4 sm:items-center sm:gap-5">
                    <Avatar className="size-14 shrink-0 sm:size-[76px]" aria-hidden="true">
                        {profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" />}
                        <AvatarFallback className="border border-border bg-card text-xl font-semibold text-secondary-foreground sm:text-2xl">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium tabular-nums text-secondary-foreground">User #{account.userId}</p>
                        <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-4xl">{name}</h1>
                        {name !== account.email && <p className="mt-1 break-words text-sm text-secondary-foreground">{account.email}</p>}
                        <p className="mt-2 text-sm text-secondary-foreground">Joined <DateText value={account.createdAt} /></p>
                    </div>
                    {currentUserId !== null && currentUserId !== account.userId && (
                        <Button ref={moderationButton} variant="outline" className="h-11" onClick={() => {
                            setNotice("");
                            setModerationTarget({ ...account, name });
                        }}>
                            {account.status === "SUSPENDED" ? "Unsuspend account" : "Suspend account"}
                        </Button>
                    )}
                </div>
                <div role="status" className={notice ? "mt-4 break-words text-sm text-secondary-foreground" : "sr-only"}>{notice}</div>
            </header>
            <AccountSuspensionDialog target={moderationTarget} currentUserId={currentUserId}
                onClose={() => setModerationTarget(null)} onSuccess={setNotice} restoreFocus={() => moderationButton.current?.focus()} />

            <div className="grid items-start lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <section aria-labelledby="user-profile-heading" className="min-w-0 px-5 py-6 sm:px-8 sm:py-8">
                    <h2 id="user-profile-heading" className="text-lg font-semibold tracking-tight">Profile</h2>
                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
                        <ProfileField label="Roles">{account.roles.map((role) => roleLabels[role] ?? role).join(", ") || "No role"}</ProfileField>
                        <ProfileField label="Account status">
                            <AccountStatusBadge status={account.status} />
                        </ProfileField>
                        <ProfileField label="Two-factor authentication">{account.twoFactorEnabled ? "Enabled" : "Disabled"}</ProfileField>
                        {profile && <ProfileField label="Profile updated"><DateText value={profile.updatedAt} /></ProfileField>}
                        <ProfileField label="Linked Solana wallet" wide>
                            {wallet?.status === "linked" ? (
                                <span className="break-all font-mono text-xs">{wallet.address}</span>
                            ) : (
                                <span className="text-muted-foreground">{wallet?.status === "unlinked" ? "No wallet linked" : "Wallet lookup unavailable"}</span>
                            )}
                        </ProfileField>
                    </dl>
                    {profile ? (
                        <>
                            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-border pt-5">
                                <ProfileField label="Phone">{profile.phone}</ProfileField>
                                <ProfileField label="Country / region">{profile.country}</ProfileField>
                                <ProfileField label="Preferred currency">{profile.preferredCurrency}</ProfileField>
                                <ProfileField label="Bio" wide>{profile.bio && <span className="whitespace-pre-wrap">{profile.bio}</span>}</ProfileField>
                                <ProfileField label="Billing address" wide>{profile.billingAddress && <span className="whitespace-pre-wrap">{profile.billingAddress}</span>}</ProfileField>
                            </dl>
                            <h3 className="mt-6 text-xs font-medium text-muted-foreground">Social links</h3>
                            {profile.socialLinks.length ? (
                                <ul className="mt-1 divide-y divide-border">
                                    {profile.socialLinks.map((url) => {
                                        const platform = getSocialPlatform(url);
                                        return (
                                            <li key={url}>
                                                <a href={url} target="_blank" rel="noreferrer" title={url} className="flex min-h-11 items-center gap-2.5 rounded-sm text-sm text-primary transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none">
                                                    <SocialLinkIcon icon={platform?.icon} className="size-4 shrink-0" />
                                                    <span className="min-w-0 flex-1 truncate">{url.replace(/^https?:\/\//, "")}</span>
                                                    <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
                                                    <span className="sr-only"> (opens in a new tab)</span>
                                                </a>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : <p className="mt-1 text-sm text-muted-foreground">No social links added.</p>}
                        </>
                    ) : <p className="mt-6 rounded-lg bg-secondary/60 px-4 py-3 text-sm text-secondary-foreground">Profile details are not available for this account yet.</p>}
                </section>

                <section aria-labelledby="user-activity-heading" className="min-w-0 self-stretch border-t border-border px-5 py-6 sm:px-8 sm:py-8 lg:border-t-0 lg:border-l">
                    <h2 id="user-activity-heading" className="text-lg font-semibold tracking-tight">Activity summary</h2>
                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 border-b border-border pb-6 xl:grid-cols-4">
                        {stats.map(({ label, value }) => (
                            <div key={label} className="flex flex-col-reverse gap-1">
                                <dt className="text-xs font-medium leading-5 text-muted-foreground">{label}</dt>
                                <dd className="text-2xl font-semibold tabular-nums tracking-tight">{value.toLocaleString()}</dd>
                            </div>
                        ))}
                    </dl>
                    <ActivityHistory userId={account.userId} firstPage={activity} />
                </section>
            </div>
        </div>
    );
}

function DetailState({ title, children }: { title: string; children?: ReactNode }) {
    return (
        <section role="alert" className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
            <UserRound className="mx-auto mb-4 size-7 text-secondary-foreground" aria-hidden="true" />
            <h1 className="text-lg font-semibold">{title}</h1>
            {children}
        </section>
    );
}

function UserDetail({ userId }: { userId: number }) {
    const { data, error, isPending, isFetching, refetch } = useUserDetail(userId);
    if (isPending) {
        return (
            <div role="status" className="flex min-h-56 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading user details…
            </div>
        );
    }

    const status = isAxiosError(error) ? error.response?.status : undefined;
    if (status === 404) return <DetailState title="User not found"><p className="mt-2 text-sm text-muted-foreground">This account may have been deleted.</p></DetailState>;
    if (status === 401 || status === 403) return <DetailState title="You don’t have access to this user." />;
    if (error || !data) {
        return (
            <DetailState title="Unable to load user details">
                <Button variant="outline" className="mt-4 h-11" disabled={isFetching} onClick={() => void refetch()}>Try again</Button>
            </DetailState>
        );
    }
    return <UserOverview data={data} />;
}

export default function AdminUserDetailPage() {
    const { userId: rawId } = useParams<{ userId: string }>();
    const { state } = useLocation();
    const userId = Number(rawId);
    const validId = typeof rawId === "string" && /^[1-9][0-9]*$/.test(rawId) && userId <= 2_147_483_647;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [userId]);

    return (
        <main className="admin-dashboard-theme min-h-[calc(100dvh-72px)] bg-background px-4 py-6 text-foreground sm:px-8 sm:py-9">
            <div className="mx-auto max-w-[1200px]">
                <nav aria-label="Breadcrumb" className="mb-4 flex min-h-11 flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <Link to="/admin/users" state={state} className="inline-flex min-h-11 items-center gap-2 rounded-sm font-medium text-primary transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none">
                        <ArrowLeft className="size-4" aria-hidden="true" /> Users
                    </Link>
                    <span aria-hidden="true" className="text-border">/</span>
                    <span aria-current="page">User details</span>
                </nav>
                {validId ? <UserDetail key={userId} userId={userId} /> : <DetailState title="User not found" />}
            </div>
        </main>
    );
}
