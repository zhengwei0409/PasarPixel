import type { Request, Response } from "express";
import axios from "axios";
import type { AdminAccountDetail, AdminUserActivity, AdminUserDetail } from "../../../../shared/types/adminUserDetail";
import { getSocialLinkUrls } from "../../../../shared/utils/socialLinks";
import { prisma } from "../lib/prisma";

const ACTIVITY_PAGE_SIZE = 8;
const activityIdOrder = new Intl.Collator("en", { numeric: true });
const listingLabels = {
    DRAFT: "Draft",
    PENDING_REVIEW: "Pending review",
    PUBLISHED: "Published",
    REJECTED: "Rejected",
    TAKEN_DOWN: "Taken down",
};
const reportLabels = { PENDING: "Pending", TAKEN_DOWN: "Taken down", DISMISSED: "Dismissed" };
const applicationLabels = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", REVOKED: "Revoked" };

async function getLinkedWallet(userId: number, authorization: string | undefined): Promise<AdminUserDetail["wallet"]> {
    const blockchainUrl = (process.env.BLOCKCHAIN_SERVICE_URL || "http://blockchain-service:3004").replace(/\/$/, "");
    try {
        const { data } = await axios.get<{ address: string | null }>(`${blockchainUrl}/blockchain/admin/wallets/${userId}`, {
            headers: { authorization },
            timeout: 5_000,
        });
        if (data.address === null) return { status: "unlinked" };
        if (typeof data.address === "string" && data.address) return { status: "linked", address: data.address };
    } catch {
        // Profile and activity remain usable if the wallet lookup fails.
    }
    return { status: "unavailable" };
}

async function getUserActivity(userId: number, requestedPage: number): Promise<AdminUserDetail["activity"]> {
    const ordersByUser = { buyerId: userId, paymentStatus: "COMPLETED" } as const;
    const listingsByUser = { sellerId: userId, isDeleted: false };
    const byUser = { userId };
    const rolesByUser = { targetUserId: userId };
    const adminActionsByUser = { userId, targetType: "USER", action: { startsWith: "DELETE_USER:" } };
    const [orders, listings, reviews, reports, applications, roleChanges, adminActions] = await Promise.all([
        prisma.order.count({ where: ordersByUser }),
        prisma.asset.count({ where: listingsByUser }),
        prisma.review.count({ where: byUser }),
        prisma.report.count({ where: byUser }),
        prisma.sellerApplication.count({ where: byUser }),
        prisma.roleChangeLog.count({ where: rolesByUser }),
        prisma.activityLog.count({ where: adminActionsByUser }),
    ]);

    const counts = { orders, listings, reviews, reports };
    const totalEvents = orders + listings + reviews + reports + applications + roleChanges + adminActions;
    const totalPages = Math.max(1, Math.ceil(totalEvents / ACTIVITY_PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    if (totalEvents === 0) return { counts, recent: [], page, totalPages };

    // A row on this page must be within the first page * pageSize rows of its own source.
    // Merge the ordered sources before slicing so different kinds share the same timeline.
    const latest = {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: page * ACTIVITY_PAGE_SIZE,
    } satisfies { orderBy: ({ createdAt: "desc" } | { id: "desc" })[]; take: number };
    const [latestOrders, latestListings, latestReviews, latestReports,
        latestApplications, latestRoleChanges, latestAdminActions] = await Promise.all([
        prisma.order.findMany({ where: ordersByUser, ...latest, select: { id: true, createdAt: true } }),
        prisma.asset.findMany({ where: listingsByUser, ...latest, select: { id: true, title: true, status: true, createdAt: true } }),
        prisma.review.findMany({ where: byUser, ...latest, select: { id: true, rating: true, asset: { select: { title: true } }, createdAt: true } }),
        prisma.report.findMany({ where: byUser, ...latest, select: { id: true, status: true, asset: { select: { title: true } }, createdAt: true } }),
        prisma.sellerApplication.findMany({ where: byUser, ...latest, select: { id: true, storeName: true, status: true, createdAt: true } }),
        prisma.roleChangeLog.findMany({ where: rolesByUser, ...latest, select: { id: true, role: true, action: true, createdAt: true } }),
        prisma.activityLog.findMany({
            where: adminActionsByUser,
            ...latest,
            select: { id: true, targetId: true, createdAt: true },
        }),
    ]);

    const events: AdminUserActivity[] = [
        ...latestOrders.map(({ id, createdAt }) => ({
            id: `order-${id}`, kind: "order" as const, title: `Placed order #${id}`,
            detail: "Payment completed", occurredAt: createdAt.toISOString(),
        })),
        ...latestListings.map(({ id, title, status, createdAt }) => ({
            id: `listing-${id}`, kind: "listing" as const, title: `Created listing · ${title}`,
            detail: listingLabels[status], occurredAt: createdAt.toISOString(),
        })),
        ...latestReviews.map(({ id, rating, asset, createdAt }) => ({
            id: `review-${id}`, kind: "review" as const, title: `Reviewed ${asset.title}`,
            detail: `${rating}/5 stars`, occurredAt: createdAt.toISOString(),
        })),
        ...latestReports.map(({ id, status, asset, createdAt }) => ({
            id: `report-${id}`, kind: "report" as const, title: `Reported ${asset.title}`,
            detail: reportLabels[status], occurredAt: createdAt.toISOString(),
        })),
        ...latestApplications.map(({ id, storeName, status, createdAt }) => ({
            id: `application-${id}`, kind: "application" as const, title: `Applied to sell · ${storeName}`,
            detail: applicationLabels[status], occurredAt: createdAt.toISOString(),
        })),
        ...latestRoleChanges.map(({ id, role, action, createdAt }) => ({
            id: `role-${id}`, kind: "role" as const,
            title: `${role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()} role ${action === "GRANT" ? "granted" : "revoked"}`,
            occurredAt: createdAt.toISOString(),
        })),
        ...latestAdminActions.map(({ id, targetId, createdAt }) => ({
            id: `admin-${id}`, kind: "admin" as const,
            title: targetId ? `Deleted user #${targetId}` : "Deleted a user",
            occurredAt: createdAt.toISOString(),
        })),
    ];

    events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)
        || a.kind.localeCompare(b.kind) || activityIdOrder.compare(b.id, a.id));
    return {
        counts,
        recent: events.slice((page - 1) * ACTIVITY_PAGE_SIZE, page * ACTIVITY_PAGE_SIZE),
        page,
        totalPages,
    };
}

export async function getAdminUserDetail(req: Request, res: Response) {
    const rawId = req.params.userId;
    const userId = Number(rawId);
    if (typeof rawId !== "string" || !/^[1-9][0-9]*$/.test(rawId) || userId > 2_147_483_647) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
    }
    const rawPage = req.query.activityPage;
    const activityPage = rawPage === undefined ? 1 : Number(rawPage);
    if (rawPage !== undefined && (
        typeof rawPage !== "string" || !/^[1-9][0-9]*$/.test(rawPage) || !Number.isSafeInteger(activityPage)
    )) {
        res.status(400).json({ error: "Invalid activity page" });
        return;
    }

    const authUrl = (process.env.AUTH_SERVICE_URL || "http://localhost:3001").replace(/\/$/, "");
    let account: AdminAccountDetail;
    try {
        const response = await axios.get<AdminAccountDetail>(`${authUrl}/auth/admin/accounts/${userId}`, {
            headers: { authorization: req.headers.authorization },
            timeout: 10_000,
        });
        account = response.data;
    } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status === 404) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        if (status === 401 || status === 403) {
            res.status(status).json({ error: "Unable to authorize the user detail request" });
            return;
        }
        res.status(503).json({ error: "Unable to load the user account. Please try again." });
        return;
    }

    const [profile, activity, wallet] = await Promise.all([
        prisma.userProfile.findUnique({
            where: { userId },
            select: {
                name: true, avatarUrl: true, bio: true, phone: true, country: true,
                billingAddress: true, preferredCurrency: true,
                socialLinks: true, updatedAt: true,
            },
        }),
        getUserActivity(userId, activityPage),
        getLinkedWallet(userId, req.headers.authorization),
    ]);

    const detail: AdminUserDetail = {
        account,
        profile: profile ? {
            ...profile,
            socialLinks: getSocialLinkUrls(profile.socialLinks),
            updatedAt: profile.updatedAt.toISOString(),
        } : null,
        wallet,
        activity,
    };
    res.set("Cache-Control", "no-store").json(detail);
}
