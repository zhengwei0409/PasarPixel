import { getRabbitChannel } from '../lib/rabbitmq';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/resend';
import { UserRegisteredEvent } from '../../../../shared/types/events';
import { EXCHANGE_USER_REGISTERED } from '../../../../shared/utils/messaging';

const QUEUE = 'user.registered.notification';

export async function startUserRegisteredConsumer(): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_USER_REGISTERED, 'fanout', { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE_USER_REGISTERED, '');

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const event: UserRegisteredEvent = JSON.parse(msg.content.toString());

            const title = 'Welcome to PasarPixel';
            const body = `Hi ${event.name}, welcome to PasarPixel! Start exploring digital assets now.`;

            try {
                await sendEmail({
                    to: event.email,
                    subject: title,
                    html: `<p>Hi ${event.name},</p><p>Welcome to PasarPixel! Start exploring digital assets now.</p>`,
                });
            } catch (emailErr) {
                console.error(`Email send failed for user ${event.userId}, continuing with in-app notification:`, emailErr);
            }

            await prisma.notification.create({
                data: {
                    userId: event.userId,
                    type: 'WELCOME',
                    title,
                    body,
                },
            });

            channel.ack(msg);
            console.log(`Processed user.registered for user ${event.userId}`);
        } catch (err) {
            console.error('Failed to process user.registered:', err);
            channel.nack(msg, false, false);
        }
    });

    console.log(`Consumer listening on queue: ${QUEUE}`);
}
