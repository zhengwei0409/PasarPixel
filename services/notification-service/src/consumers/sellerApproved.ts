import { getRabbitChannel } from '../lib/rabbitmq';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/resend';
import { SellerApprovedEvent } from '../../../../shared/types/events';
import { EXCHANGE_SELLER_APPROVED } from '../../../../shared/utils/messaging';

const QUEUE = 'seller.approved.notification';

export async function startSellerApprovedConsumer(): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_SELLER_APPROVED, 'fanout', { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE_SELLER_APPROVED, '');

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const event: SellerApprovedEvent = JSON.parse(msg.content.toString());

            const title = 'Your seller application is approved';
            const body = `Congratulations! Your store "${event.storeName}" has been approved. You can now start listing assets on PasarPixel.`;

            await sendEmail({
                to: event.email,
                subject: title,
                html: `
                    <p>Congratulations!</p>
                    <p>Your store <strong>${event.storeName}</strong> has been approved on PasarPixel.</p>
                    <p>You can now start listing your digital assets for sale.</p>
                `,
            });

            await prisma.notification.create({
                data: {
                    userId: event.userId,
                    type: 'SELLER_APPROVED',
                    title,
                    body,
                },
            });

            channel.ack(msg);
            console.log(`Processed seller.approved for user ${event.userId}`);
        } catch (err) {
            console.error('Failed to process seller.approved:', err);
            channel.nack(msg, false, false);
        }
    });

    console.log(`Consumer listening on queue: ${QUEUE}`);
}
