import { getRabbitChannel } from '../lib/rabbitmq';
import { prisma } from '../lib/prisma';
import { AssetApprovedEvent } from '../../../../shared/types/events';
import { EXCHANGE_ASSET_APPROVED } from '../../../../shared/utils/messaging';

const QUEUE = 'asset.approved.notification';

export async function startAssetApprovedConsumer(): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_ASSET_APPROVED, 'fanout', { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE_ASSET_APPROVED, '');

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const event: AssetApprovedEvent = JSON.parse(msg.content.toString());

            await prisma.notification.create({
                data: {
                    userId: event.sellerId,
                    type: 'ASSET_APPROVED',
                    title: 'Your asset is approved',
                    body: `Your asset "${event.assetTitle}" has been approved and is now live on PasarPixel.`,
                },
            });

            channel.ack(msg);
            console.log(`Processed asset.approved for seller ${event.sellerId}`);
        } catch (err) {
            console.error('Failed to process asset.approved:', err);
            channel.nack(msg, false, false);
        }
    });

    console.log(`Consumer listening on queue: ${QUEUE}`);
}
