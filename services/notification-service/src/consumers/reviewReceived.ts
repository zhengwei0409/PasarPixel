import { getRabbitChannel } from '../lib/rabbitmq';
import { prisma } from '../lib/prisma';
import { ReviewReceivedEvent } from '../../../../shared/types/events';
import { EXCHANGE_REVIEW_RECEIVED } from '../../../../shared/utils/messaging';

const QUEUE = 'review.received.notification';

export async function startReviewReceivedConsumer(): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_REVIEW_RECEIVED, 'fanout', { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE_REVIEW_RECEIVED, '');

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const event: ReviewReceivedEvent = JSON.parse(msg.content.toString());

            await prisma.notification.create({
                data: {
                    userId: event.sellerId,
                    type: 'REVIEW_RECEIVED',
                    title: 'New review on your asset',
                    body: `Your asset "${event.assetTitle}" received a ${event.rating}-star review.`,
                },
            });

            channel.ack(msg);
            console.log(`Processed review.received for seller ${event.sellerId}`);
        } catch (err) {
            console.error('Failed to process review.received:', err);
            channel.nack(msg, false, false);
        }
    });

    console.log(`Consumer listening on queue: ${QUEUE}`);
}
