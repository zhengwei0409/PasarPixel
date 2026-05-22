import { getRabbitChannel } from './rabbitmq';
import { UserRegisteredEvent } from '../../../../shared/types/events';
import { EXCHANGE_USER_REGISTERED } from '../../../../shared/utils/messaging';

export async function publishUserRegistered(event: UserRegisteredEvent): Promise<void> {
  const channel = await getRabbitChannel();
  await channel.assertExchange(EXCHANGE_USER_REGISTERED, 'fanout', { durable: true });
  channel.publish(EXCHANGE_USER_REGISTERED, '', Buffer.from(JSON.stringify(event)));
}
