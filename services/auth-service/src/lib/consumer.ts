import { getRabbitChannel } from './rabbitmq';
import { prisma } from './prisma';
import { SellerApprovedEvent, SellerRevokedEvent, SellerReinstatedEvent } from '../../../../shared/types/events';
import { EXCHANGE_SELLER_APPROVED, EXCHANGE_SELLER_REVOKED, EXCHANGE_SELLER_REINSTATED } from '../../../../shared/utils/messaging';

const APPROVED_QUEUE = 'seller.approved.auth';
const REVOKED_QUEUE = 'seller.revoked.auth';
const REINSTATED_QUEUE = 'seller.reinstated.auth';

export async function startConsumer(): Promise<void> {
    const channel = await getRabbitChannel();

    // seller.approved -> grant SELLER role
    await channel.assertExchange(EXCHANGE_SELLER_APPROVED, 'fanout', { durable: true });
    await channel.assertQueue(APPROVED_QUEUE, { durable: true });
    await channel.bindQueue(APPROVED_QUEUE, EXCHANGE_SELLER_APPROVED, '');

    channel.consume(APPROVED_QUEUE, async (msg) => {
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

    // seller.revoked -> remove SELLER role
    await channel.assertExchange(EXCHANGE_SELLER_REVOKED, 'fanout', { durable: true });
    await channel.assertQueue(REVOKED_QUEUE, { durable: true });
    await channel.bindQueue(REVOKED_QUEUE, EXCHANGE_SELLER_REVOKED, '');

    channel.consume(REVOKED_QUEUE, async (msg) => {
        if (!msg) return;

        const event: SellerRevokedEvent = JSON.parse(msg.content.toString());

        const sellerRole = await prisma.role.findUnique({ where: { name: 'SELLER' } });
        if (!sellerRole) {
            console.error('SELLER role not found in DB');
            channel.nack(msg, false, false);
            return;
        }

        await prisma.userRole.deleteMany({
            where: { userId: event.userId, roleId: sellerRole.id },
        });

        channel.ack(msg);
        console.log(`Removed SELLER role from user ${event.userId}`);
    });

    // seller.reinstated -> grant SELLER role back
    await channel.assertExchange(EXCHANGE_SELLER_REINSTATED, 'fanout', { durable: true });
    await channel.assertQueue(REINSTATED_QUEUE, { durable: true });
    await channel.bindQueue(REINSTATED_QUEUE, EXCHANGE_SELLER_REINSTATED, '');

    channel.consume(REINSTATED_QUEUE, async (msg) => {
        if (!msg) return;

        const event: SellerReinstatedEvent = JSON.parse(msg.content.toString());

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
        console.log(`Restored SELLER role to user ${event.userId}`);
    });

    console.log(`Auth-service consumer listening on queues: ${APPROVED_QUEUE}, ${REVOKED_QUEUE}, ${REINSTATED_QUEUE}`);
}
