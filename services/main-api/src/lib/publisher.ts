import { getRabbitChannel } from './rabbitmq';
import { SellerApprovedEvent } from '../../../../shared/types/events';
import { EXCHANGE_SELLER_APPROVED } from '../../../../shared/utils/messaging';

export async function publishSellerApproved(event: SellerApprovedEvent): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_SELLER_APPROVED, 'fanout', { durable: true });
    channel.publish(EXCHANGE_SELLER_APPROVED, '', Buffer.from(JSON.stringify(event)));
}
