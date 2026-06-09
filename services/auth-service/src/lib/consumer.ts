import { getRabbitChannel } from './rabbitmq';
import { prisma } from './prisma';
import { SellerApprovedEvent, SellerRevokedEvent, SellerReinstatedEvent, UserDeletedEvent } from '../../../../shared/types/events';
import { EXCHANGE_SELLER_APPROVED, EXCHANGE_SELLER_REVOKED, EXCHANGE_SELLER_REINSTATED, EXCHANGE_USER_DELETED } from '../../../../shared/utils/messaging';

const APPROVED_QUEUE = 'seller.approved.auth';
const REVOKED_QUEUE = 'seller.revoked.auth';
const REINSTATED_QUEUE = 'seller.reinstated.auth';
const USER_DELETED_QUEUE = 'user.deleted.auth';

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

    // user.deleted -> delete the account and everything tied to it
    await channel.assertExchange(EXCHANGE_USER_DELETED, 'fanout', { durable: true });
    await channel.assertQueue(USER_DELETED_QUEUE, { durable: true });
    await channel.bindQueue(USER_DELETED_QUEUE, EXCHANGE_USER_DELETED, '');

    channel.consume(USER_DELETED_QUEUE, async (msg) => {
        if (!msg) return;

        try {
            const event: UserDeletedEvent = JSON.parse(msg.content.toString());

            // Delete children before the User row, in FK-safe order.
            await prisma.$transaction(async (tx) => {
                const twoFactor = await tx.twoFactorAuth.findUnique({
                    where: { userId: event.userId },
                });
                if (twoFactor) {
                    await tx.recoveryCode.deleteMany({ where: { twoFactorAuthId: twoFactor.id } });
                    await tx.twoFactorAuth.delete({ where: { userId: event.userId } });
                }

                await tx.userRole.deleteMany({ where: { userId: event.userId } });
                await tx.loginAttempt.deleteMany({ where: { userId: event.userId } });
                await tx.passwordReset.deleteMany({ where: { userId: event.userId } });
                await tx.refreshToken.deleteMany({ where: { userId: event.userId } });
                await tx.user.delete({ where: { id: event.userId } });
            });

            channel.ack(msg);
            console.log(`Deleted account for user ${event.userId}`);
        } catch (err) {
            console.error('Failed to process user.deleted:', err);
            channel.nack(msg, false, false);
        }
    });

    console.log(`Auth-service consumer listening on queues: ${APPROVED_QUEUE}, ${REVOKED_QUEUE}, ${REINSTATED_QUEUE}, ${USER_DELETED_QUEUE}`);
}
