import { getRabbitChannel } from '../lib/rabbitmq';
import { prisma } from '../lib/prisma';
import { OrderPaidEvent } from '../../../../shared/types/events';
import { EXCHANGE_ORDER_PAID } from '../../../../shared/utils/messaging';

const QUEUE = 'order.paid.notification';

export async function startOrderPaidConsumer(): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_ORDER_PAID, 'fanout', { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE_ORDER_PAID, '');

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const event: OrderPaidEvent = JSON.parse(msg.content.toString());

            const itemLabel = event.itemCount === 1 ? 'item' : 'items';

            await prisma.notification.create({
                data: {
                    userId: event.buyerId,
                    type: 'ORDER_PAID',
                    title: 'Payment successful',
                    body: `Your order #${event.orderId} with ${event.itemCount} ${itemLabel} has been paid. You can now download your assets.`,
                },
            });

            channel.ack(msg);
            console.log(`Processed order.paid for buyer ${event.buyerId}`);
        } catch (err) {
            console.error('Failed to process order.paid:', err);
            channel.nack(msg, false, false);
        }
    });

    console.log(`Consumer listening on queue: ${QUEUE}`);
}
