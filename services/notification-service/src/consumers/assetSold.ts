import { getRabbitChannel } from '../lib/rabbitmq';
import { prisma } from '../lib/prisma';
import { AssetSoldEvent } from '../../../../shared/types/events';
import { EXCHANGE_ASSET_SOLD } from '../../../../shared/utils/messaging';

const QUEUE = 'asset.sold.notification';

export async function startAssetSoldConsumer(): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_ASSET_SOLD, 'fanout', { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE_ASSET_SOLD, '');

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const event: AssetSoldEvent = JSON.parse(msg.content.toString());

            await prisma.notification.create({
                data: {
                    userId: event.sellerId,
                    type: 'ASSET_SOLD',
                    title: 'You made a sale',
                    body: `Your asset "${event.assetTitle}" was sold in order #${event.orderId}.`,
                },
            });

            channel.ack(msg);
            console.log(`Processed asset.sold for seller ${event.sellerId}`);
        } catch (err) {
            console.error('Failed to process asset.sold:', err);
            channel.nack(msg, false, false);
        }
    });

    console.log(`Consumer listening on queue: ${QUEUE}`);
}
