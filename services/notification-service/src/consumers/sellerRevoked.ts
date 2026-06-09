import { getRabbitChannel } from '../lib/rabbitmq';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/resend';
import { SellerRevokedEvent } from '../../../../shared/types/events';
import { EXCHANGE_SELLER_REVOKED } from '../../../../shared/utils/messaging';

const QUEUE = 'seller.revoked.notification';

export async function startSellerRevokedConsumer(): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_SELLER_REVOKED, 'fanout', { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE_SELLER_REVOKED, '');

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const event: SellerRevokedEvent = JSON.parse(msg.content.toString());

            const title = 'Your seller role has been revoked';
            const body = `Your seller role for store "${event.storeName}" has been revoked by an admin. Reason: ${event.adminNote}. Your published listings are now hidden from the marketplace.`;

            try {
                await sendEmail({
                    to: event.email,
                    subject: title,
                    html: `
                        <p>Your seller role for store <strong>${event.storeName}</strong> has been revoked by an admin on PasarPixel.</p>
                        <p><strong>Reason:</strong> ${event.adminNote}</p>
                        <p>Your published listings are now hidden from the marketplace.</p>
                        <p>If you believe this was a mistake, please contact support.</p>
                    `,
                });
            } catch (emailErr) {
                console.error(`Email send failed for user ${event.userId}, continuing with in-app notification:`, emailErr);
            }

            await prisma.notification.create({
                data: {
                    userId: event.userId,
                    type: 'SELLER_REVOKED',
                    title,
                    body,
                },
            });

            channel.ack(msg);
            console.log(`Processed seller.revoked for user ${event.userId}`);
        } catch (err) {
            console.error('Failed to process seller.revoked:', err);
            channel.nack(msg, false, false);
        }
    });

    console.log(`Consumer listening on queue: ${QUEUE}`);
}
