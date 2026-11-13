import { getRabbitChannel } from "../lib/rabbitmq";
import { prisma } from "../lib/prisma";
import type { AccountModerationEvent } from "../../../../shared/types/events";
import {
    ACCOUNT_MODERATION_QUEUE, ACCOUNT_MODERATION_QUEUE_OPTIONS, ACCOUNT_MODERATION_RETRY_QUEUE,
} from "../../../../shared/utils/messaging";

export async function recordAccountModeration(event: AccountModerationEvent) {
    const title = event.suspended ? "Your account has been suspended" : "Your account has been unsuspended";
    await prisma.notification.createMany({
        data: [{
            userId: event.userId,
            accountModerationId: event.id,
            type: event.suspended ? "ACCOUNT_SUSPENDED" : "ACCOUNT_UNSUSPENDED",
            title,
            body: `Reason: ${event.reason}`,
            createdAt: new Date(event.createdAt),
        }],
        skipDuplicates: true,
    });
}

export async function startAccountModerationConsumer(): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertQueue(ACCOUNT_MODERATION_QUEUE, ACCOUNT_MODERATION_QUEUE_OPTIONS);
    await channel.assertQueue(ACCOUNT_MODERATION_RETRY_QUEUE, {
        durable: true,
        messageTtl: 60_000,
        deadLetterExchange: "",
        deadLetterRoutingKey: ACCOUNT_MODERATION_QUEUE,
    });
    await channel.consume(ACCOUNT_MODERATION_QUEUE, async (message) => {
        if (!message) return;
        try {
            await recordAccountModeration(JSON.parse(message.content.toString()));
            channel.ack(message);
        } catch (error) {
            console.error("Account moderation notification will retry:", error);
            channel.nack(message, false, false);
        }
    });
}
