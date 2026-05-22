import { getRabbitChannel } from './rabbitmq';
import { prisma } from './prisma';
import { SellerApprovedEvent } from '../../../../shared/types/events';
import { EXCHANGE_SELLER_APPROVED } from '../../../../shared/utils/messaging';

const QUEUE = 'seller.approved.auth';

export async function startConsumer(): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_SELLER_APPROVED, 'fanout', { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE_SELLER_APPROVED, '');

    channel.consume(QUEUE, async (msg) => {
        if (!msg) return;

        const event: SellerApprovedEvent = JSON.parse(msg.content.toString());

        const sellerRole = await prisma.role.findUnique({ where: { name: 'SELLER' } });
        if (!sellerRole) {
            console.error('SELLER role not found in DB');
            channel.nack(msg, false, false);
            return;
        }

        await prisma.userRole.upsert({
            where: { userId_roleId: { userId: event.userId, roleId: sellerRole.id } },
            update: {},
            create: { userId: event.userId, roleId: sellerRole.id },
        });

        channel.ack(msg);
        console.log(`Assigned SELLER role to user ${event.userId}`);
    });

    console.log(`Auth-service consumer listening on queue: ${QUEUE}`);
}
