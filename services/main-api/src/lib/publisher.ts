import { getRabbitChannel } from './rabbitmq';
import { SellerApprovedEvent, SellerRejectedEvent } from '../../../../shared/types/events';
import { EXCHANGE_SELLER_APPROVED, EXCHANGE_SELLER_REJECTED } from '../../../../shared/utils/messaging';

export async function publishSellerApproved(event: SellerApprovedEvent): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_SELLER_APPROVED, 'fanout', { durable: true });
    channel.publish(EXCHANGE_SELLER_APPROVED, '', Buffer.from(JSON.stringify(event)));
}

export async function publishSellerRejected(event: SellerRejectedEvent): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_SELLER_REJECTED, 'fanout', { durable: true });
    channel.publish(EXCHANGE_SELLER_REJECTED, '', Buffer.from(JSON.stringify(event)));
}
