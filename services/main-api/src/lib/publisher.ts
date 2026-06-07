import { getRabbitChannel } from './rabbitmq';
import {
    SellerApprovedEvent,
    SellerRejectedEvent,
    SellerRevokedEvent,
    SellerReinstatedEvent,
    AssetApprovedEvent,
    AssetRejectedEvent,
    AssetRemovedEvent,
    OrderPaidEvent,
    AssetSoldEvent,
    ReviewReceivedEvent,
} from '../../../../shared/types/events';
import {
    EXCHANGE_SELLER_APPROVED,
    EXCHANGE_SELLER_REJECTED,
    EXCHANGE_SELLER_REVOKED,
    EXCHANGE_SELLER_REINSTATED,
    EXCHANGE_ASSET_APPROVED,
    EXCHANGE_ASSET_REJECTED,
    EXCHANGE_ASSET_REMOVED,
    EXCHANGE_ORDER_PAID,
    EXCHANGE_ASSET_SOLD,
    EXCHANGE_REVIEW_RECEIVED,
} from '../../../../shared/utils/messaging';

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

export async function publishSellerRevoked(event: SellerRevokedEvent): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_SELLER_REVOKED, 'fanout', { durable: true });
    channel.publish(EXCHANGE_SELLER_REVOKED, '', Buffer.from(JSON.stringify(event)));
}

export async function publishSellerReinstated(event: SellerReinstatedEvent): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_SELLER_REINSTATED, 'fanout', { durable: true });
    channel.publish(EXCHANGE_SELLER_REINSTATED, '', Buffer.from(JSON.stringify(event)));
}

export async function publishAssetApproved(event: AssetApprovedEvent): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_ASSET_APPROVED, 'fanout', { durable: true });
    channel.publish(EXCHANGE_ASSET_APPROVED, '', Buffer.from(JSON.stringify(event)));
}

export async function publishAssetRejected(event: AssetRejectedEvent): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_ASSET_REJECTED, 'fanout', { durable: true });
    channel.publish(EXCHANGE_ASSET_REJECTED, '', Buffer.from(JSON.stringify(event)));
}

export async function publishAssetRemoved(event: AssetRemovedEvent): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_ASSET_REMOVED, 'fanout', { durable: true });
    channel.publish(EXCHANGE_ASSET_REMOVED, '', Buffer.from(JSON.stringify(event)));
}

export async function publishOrderPaid(event: OrderPaidEvent): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_ORDER_PAID, 'fanout', { durable: true });
    channel.publish(EXCHANGE_ORDER_PAID, '', Buffer.from(JSON.stringify(event)));
}

export async function publishAssetSold(event: AssetSoldEvent): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_ASSET_SOLD, 'fanout', { durable: true });
    channel.publish(EXCHANGE_ASSET_SOLD, '', Buffer.from(JSON.stringify(event)));
}

export async function publishReviewReceived(event: ReviewReceivedEvent): Promise<void> {
    const channel = await getRabbitChannel();
    await channel.assertExchange(EXCHANGE_REVIEW_RECEIVED, 'fanout', { durable: true });
    channel.publish(EXCHANGE_REVIEW_RECEIVED, '', Buffer.from(JSON.stringify(event)));
}
