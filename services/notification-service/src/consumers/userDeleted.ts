import { getRabbitChannel } from '../lib/rabbitmq';
import { prisma } from '../lib/prisma';
import { UserDeletedEvent } from '../../../../shared/types/events';
import { EXCHANGE_USER_DELETED } from '../../../../shared/utils/messaging';

const QUEUE = 'user.deleted.notification';

export async function startUserDeletedConsumer(): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_USER_DELETED, 'fanout', { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE_USER_DELETED, '');

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const event: UserDeletedEvent = JSON.parse(msg.content.toString());

            await prisma.notification.deleteMany({ where: { userId: event.userId } });

            channel.ack(msg);
            console.log(`Deleted notifications for user ${event.userId}`);
        } catch (err) {
            console.error('Failed to process user.deleted:', err);
            channel.nack(msg, false, false);
        }
    });

    console.log(`Consumer listening on queue: ${QUEUE}`);
}
