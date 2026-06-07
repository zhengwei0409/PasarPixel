import { getRabbitChannel } from '../lib/rabbitmq';
import { prisma } from '../lib/prisma';
import { AssetRejectedEvent } from '../../../../shared/types/events';
import { EXCHANGE_ASSET_REJECTED } from '../../../../shared/utils/messaging';

const QUEUE = 'asset.rejected.notification';

export async function startAssetRejectedConsumer(): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_ASSET_REJECTED, 'fanout', { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE_ASSET_REJECTED, '');

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const event: AssetRejectedEvent = JSON.parse(msg.content.toString());

            const reasonLine = event.rejectionReason ? ` Reason: ${event.rejectionReason}` : '';

            await prisma.notification.create({
                data: {
                    userId: event.sellerId,
                    type: 'ASSET_REJECTED',
                    title: 'Your asset was rejected',
                    body: `Your asset "${event.assetTitle}" was rejected.${reasonLine}`,
                },
            });

            channel.ack(msg);
            console.log(`Processed asset.rejected for seller ${event.sellerId}`);
        } catch (err) {
            console.error('Failed to process asset.rejected:', err);
            channel.nack(msg, false, false);
        }
    });

    console.log(`Consumer listening on queue: ${QUEUE}`);
}
