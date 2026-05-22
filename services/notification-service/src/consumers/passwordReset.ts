import { getRabbitChannel } from '../lib/rabbitmq';
import { sendEmail } from '../lib/resend';
import { PasswordResetEvent } from '../../../../shared/types/events';
import { EXCHANGE_PASSWORD_RESET } from '../../../../shared/utils/messaging';

const QUEUE = 'password.reset.notification';

export async function startPasswordResetConsumer(): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_PASSWORD_RESET, 'fanout', { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE_PASSWORD_RESET, '');

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const event: PasswordResetEvent = JSON.parse(msg.content.toString());

            const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${event.resetToken}`;

            await sendEmail({
                to: event.email,
                subject: 'Reset your password',
                html: `
                    <p>You requested a password reset.</p>
                    <p><a href="${resetUrl}">Click here to reset your password</a></p>
                    <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
                `,
            });

            channel.ack(msg);
            console.log(`Processed password.reset for user ${event.userId}`);
        } catch (err) {
            console.error('Failed to process password.reset:', err);
            channel.nack(msg, false, false);
        }
    });

    console.log(`Consumer listening on queue: ${QUEUE}`);
}
