import { getRabbitChannel } from '../lib/rabbitmq';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/resend';
import { SellerReinstatedEvent } from '../../../../shared/types/events';
import { EXCHANGE_SELLER_REINSTATED } from '../../../../shared/utils/messaging';

const QUEUE = 'seller.reinstated.notification';

export async function startSellerReinstatedConsumer(): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_SELLER_REINSTATED, 'fanout', { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE_SELLER_REINSTATED, '');

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const event: SellerReinstatedEvent = JSON.parse(msg.content.toString());

            const title = 'Your seller role has been reinstated';
            const body = `Good news! Your seller role for store "${event.storeName}" has been reinstated. Your listings are live on the marketplace again.`;

            try {
                await sendEmail({
                    to: event.email,
                    subject: title,
                    html: `
                        <p>Good news!</p>
                        <p>Your seller role for store <strong>${event.storeName}</strong> has been reinstated on PasarPixel.</p>
                        <p>Your listings are live on the marketplace again.</p>
                    `,
                });
            } catch (emailErr) {
                console.error(`Email send failed for user ${event.userId}, continuing with in-app notification:`, emailErr);
            }

            await prisma.notification.create({
                data: {
                    userId: event.userId,
                    type: 'SELLER_REINSTATED',
                    title,
                    body,
                },
            });

            channel.ack(msg);
            console.log(`Processed seller.reinstated for user ${event.userId}`);
        } catch (err) {
            console.error('Failed to process seller.reinstated:', err);
            channel.nack(msg, false, false);
        }
    });

    console.log(`Consumer listening on queue: ${QUEUE}`);
}
