import { getRabbitChannel } from './rabbitmq';
import { UserRegisteredEvent, PasswordResetEvent } from '../../../../shared/types/events';
import { EXCHANGE_USER_REGISTERED, EXCHANGE_PASSWORD_RESET } from '../../../../shared/utils/messaging';

export async function publishUserRegistered(event: UserRegisteredEvent): Promise<void> {
  const channel = await getRabbitChannel();
  await channel.assertExchange(EXCHANGE_USER_REGISTERED, 'fanout', { durable: true });
  channel.publish(EXCHANGE_USER_REGISTERED, '', Buffer.from(JSON.stringify(event)));
}

export async function publishPasswordReset(event: PasswordResetEvent): Promise<void> {
  const channel = await getRabbitChannel();
  await channel.assertExchange(EXCHANGE_PASSWORD_RESET, 'fanout', { durable: true });
  channel.publish(EXCHANGE_PASSWORD_RESET, '', Buffer.from(JSON.stringify(event)));
}
