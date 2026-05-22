import { getRabbitChannel } from '../lib/rabbitmq';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/resend';
import { SellerRejectedEvent } from '../../../../shared/types/events';
import { EXCHANGE_SELLER_REJECTED } from '../../../../shared/utils/messaging';

const QUEUE = 'seller.rejected.notification';

export async function startSellerRejectedConsumer(): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_SELLER_REJECTED, 'fanout', { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE_SELLER_REJECTED, '');

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const event: SellerRejectedEvent = JSON.parse(msg.content.toString());

            const title = 'Your seller application was rejected';
            const noteLine = event.adminNote ? `Reason: ${event.adminNote}` : '';
            const body = `We're sorry — your seller application for "${event.storeName}" was rejected. ${noteLine}`.trim();

            await sendEmail({
                to: event.email,
                subject: title,
                html: `
                    <p>We're sorry — your seller application for <strong>${event.storeName}</strong> was rejected.</p>
                    ${event.adminNote ? `<p><strong>Reason:</strong> ${event.adminNote}</p>` : ''}
                    <p>You may submit a new application after addressing the feedback.</p>
                `,
            });

            await prisma.notification.create({
                data: {
                    userId: event.userId,
                    type: 'SELLER_REJECTED',
                    title,
                    body,
                },
            });

            channel.ack(msg);
            console.log(`Processed seller.rejected for user ${event.userId}`);
        } catch (err) {
            console.error('Failed to process seller.rejected:', err);
            channel.nack(msg, false, false);
        }
    });

    console.log(`Consumer listening on queue: ${QUEUE}`);
}
