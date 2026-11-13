import amqplib from "amqplib";
import { prisma } from "./prisma";
import type { AccountModerationEvent } from "../../../../shared/types/events";
import { ACCOUNT_MODERATION_QUEUE, ACCOUNT_MODERATION_QUEUE_OPTIONS } from "../../../../shared/utils/messaging";

async function publishPendingModeration() {
    const pending = await prisma.accountModeration.findMany({
        where: { publishedAt: null },
        orderBy: { id: "asc" },
        take: 50,
        select: { id: true, userId: true, suspended: true, reason: true, createdAt: true },
    });
    if (!pending.length) return;

    const connection = await amqplib.connect(process.env.RABBITMQ_URL!, { timeout: 5_000 });
    connection.on("error", (error) => console.error("Moderation queue connection failed:", error.message));
    try {
        const channel = await connection.createConfirmChannel();
        channel.on("error", (error) => console.error("Moderation queue channel failed:", error.message));
        await channel.assertQueue(ACCOUNT_MODERATION_QUEUE, ACCOUNT_MODERATION_QUEUE_OPTIONS);
        for (const row of pending) {
            const event: AccountModerationEvent = { ...row, createdAt: row.createdAt.toISOString() };
            channel.sendToQueue(ACCOUNT_MODERATION_QUEUE, Buffer.from(JSON.stringify(event)), { persistent: true });
            await channel.waitForConfirms();
            await prisma.accountModeration.update({ where: { id: event.id }, data: { publishedAt: new Date() } });
        }
    } finally {
        await connection.close().catch(() => {});
    }
}

export function startAccountModerationPublisher() {
    async function tick() {
        try {
            await publishPendingModeration();
        } catch (error) {
            console.error("Account moderation notifications will retry:", error);
        } finally {
            setTimeout(() => void tick(), 5_000).unref();
        }
    }
    void tick();
}
