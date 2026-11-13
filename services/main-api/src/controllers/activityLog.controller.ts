import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { ACTIVITY_CATEGORIES, type AdminActivityEntry, type AdminActivityFilters } from "../../../../shared/types/adminActivityLog";
import { serializeCsv } from "../../../../shared/utils/csv";
import { prisma } from "../lib/prisma";

const PAGE_SIZE = 25;
const FILTER_KEYS = ["search", "category", "from", "to"] as const;
type ActivityRow = Omit<AdminActivityEntry, "createdAt"> & { createdAt: Date };

function isDate(value: string) {
    if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseFilters(query: Request["query"]): AdminActivityFilters | null {
    const filters: Record<string, string> = {};
    for (const key of FILTER_KEYS) {
        const value = query[key];
        if (value === undefined) continue;
        if (typeof value !== "string" || value.includes("\0")) return null;
        filters[key] = value.trim();
    }
    const { search, category, from, to } = filters;
    if ((search && search.length > 200) || (category && !Object.prototype.hasOwnProperty.call(ACTIVITY_CATEGORIES, category))
        || (from && !isDate(from)) || (to && !isDate(to)) || (from && to && from > to)) return null;
    return { search, category: category as AdminActivityFilters["category"], from, to };
}

function queryActivity(filters: AdminActivityFilters, pagination = Prisma.empty) {
    const { search, category, from, to } = filters;
    const conditions: Prisma.Sql[] = [];
    if (category) conditions.push(Prisma.sql`category = ${category}`);
    if (from) conditions.push(Prisma.sql`"createdAt" >= CAST(${from} AS date)`);
    if (to) conditions.push(Prisma.sql`"createdAt" < CAST(${to} AS date) + INTERVAL '1 day'`);
    if (search) conditions.push(Prisma.sql`strpos(lower(concat_ws(' ', id, action, "actorName", "actorEmail",
        'User #' || "actorId", "targetLabel", "targetEmail", '#' || "targetId", reason)), lower(${search})) > 0`);
    const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

    return prisma.$queryRaw<ActivityRow[]>`
        WITH events AS (
            SELECT 'role-' || log.id AS id, log.id AS "sourceId", 'ROLE_CHANGE' AS category,
                log.role || CASE WHEN log.action = 'GRANT' THEN ' granted' ELSE ' revoked' END AS action,
                log."adminUserId" AS "actorId", actor.name AS "actorName", actor.email AS "actorEmail",
                log."targetUserId" AS "targetId", COALESCE(NULLIF(target.name, ''), target.email,
                    'User #' || log."targetUserId") AS "targetLabel", target.email AS "targetEmail",
                log.reason, log."createdAt"
            FROM role_change_logs log
            LEFT JOIN user_profiles actor ON actor."userId" = log."adminUserId"
            LEFT JOIN user_profiles target ON target."userId" = log."targetUserId"

            UNION ALL

            SELECT 'asset-' || log.id, log.id, 'ASSET_REVIEW',
                CASE WHEN log.action = 'APPROVE' THEN 'Asset approved' ELSE 'Asset rejected' END,
                log."adminUserId", actor.name, actor.email, log."assetId",
                COALESCE(NULLIF(asset.title, ''), 'Asset #' || log."assetId"), NULL, log.reason, log."createdAt"
            FROM asset_review_logs log
            LEFT JOIN user_profiles actor ON actor."userId" = log."adminUserId"
            LEFT JOIN assets asset ON asset.id = log."assetId"

            UNION ALL

            SELECT 'activity-' || log.id, log.id, 'OTHER',
                CASE WHEN starts_with(log.action, 'DELETE_USER:') THEN 'User deleted' ELSE log.action END,
                log."userId", actor.name, actor.email, log."targetId",
                NULLIF(concat_ws(' ', initcap(replace(log."targetType", '_', ' ')), '#' || log."targetId"), ''),
                NULL, CASE WHEN starts_with(log.action, 'DELETE_USER:')
                    THEN trim(substring(log.action FROM length('DELETE_USER:') + 1)) END, log."createdAt"
            FROM activity_logs log
            LEFT JOIN user_profiles actor ON actor."userId" = log."userId"
        )
        SELECT id, category, action, "actorId", "actorName", "actorEmail", "targetId", "targetLabel", reason, "createdAt"
        FROM events ${where}
        ORDER BY "createdAt" DESC, category, "sourceId" DESC ${pagination}
    `;
}

export async function listActivityLogs(req: Request, res: Response) {
    const filters = parseFilters(req.query);
    const rawPage = req.query.page ?? "1";
    const page = typeof rawPage === "string" && /^[1-9]\d{0,6}$/.test(rawPage) ? Number(rawPage) : 0;
    if (!filters || page < 1 || page > 1_000_000) {
        res.status(400).json({ error: "Invalid activity log filters or page" });
        return;
    }

    const rows = await queryActivity(filters, Prisma.sql`LIMIT ${PAGE_SIZE + 1} OFFSET ${(page - 1) * PAGE_SIZE}`);
    res.set("Cache-Control", "no-store").json({ items: rows.slice(0, PAGE_SIZE), hasNextPage: rows.length > PAGE_SIZE });
}

export async function exportActivityLogs(req: Request, res: Response) {
    const filters = parseFilters(req.query);
    if (!filters) {
        res.status(400).json({ error: "Invalid activity log filters" });
        return;
    }

    const rows = await queryActivity(filters);
    const csv = serializeCsv([
        ["Event ID", "Timestamp (UTC)", "Category", "Action", "Actor ID", "Actor name", "Actor email", "Subject ID", "Subject", "Reason"],
        ...rows.map((row) => [row.id, row.createdAt.toISOString(), ACTIVITY_CATEGORIES[row.category], row.action,
            String(row.actorId), row.actorName ?? "", row.actorEmail ?? "", String(row.targetId ?? ""), row.targetLabel ?? "", row.reason ?? ""]),
    ]);
    res.set("Cache-Control", "no-store")
        .attachment(`pasarpixel-activity-log-${new Date().toISOString().slice(0, 10)}.csv`)
        .type("text/csv").send(csv);
}
