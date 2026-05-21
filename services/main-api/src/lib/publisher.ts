import { getRabbitChannel } from './rabbitmq';
import { SellerApprovedEvent } from '../../../../shared/types/events';

const SELLER_APPROVED_QUEUE = 'seller.approved';

export async function publishSellerApproved(event: SellerApprovedEvent): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertQueue(SELLER_APPROVED_QUEUE, { durable: true });
    channel.sendToQueue(SELLER_APPROVED_QUEUE, Buffer.from(JSON.stringify(event)));
}
