import { getRabbitChannel } from '../lib/rabbitmq';
import { prisma } from '../lib/prisma';
import { AssetRemovedEvent } from '../../../../shared/types/events';
import { EXCHANGE_ASSET_REMOVED } from '../../../../shared/utils/messaging';

const QUEUE = 'asset.removed.notification';

export async function startAssetRemovedConsumer(): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_ASSET_REMOVED, 'fanout', { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE_ASSET_REMOVED, '');

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const event: AssetRemovedEvent = JSON.parse(msg.content.toString());

            const reasonSuffix = event.reason ? ` Reason: ${event.reason}` : '';

            await prisma.notification.create({
                data: {
                    userId: event.sellerId,
                    type: 'ASSET_REMOVED',
                    title: 'Your asset was taken down',
                    body: `Your asset "${event.assetTitle}" has been taken down and is no longer listed on PasarPixel.${reasonSuffix}`,
                },
            });

            channel.ack(msg);
            console.log(`Processed asset.removed for seller ${event.sellerId}`);
        } catch (err) {
            console.error('Failed to process asset.removed:', err);
            channel.nack(msg, false, false);
        }
    });

    console.log(`Consumer listening on queue: ${QUEUE}`);
}
