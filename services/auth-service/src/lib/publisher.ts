import { getRabbitChannel } from './rabbitmq';
import { UserRegisteredEvent } from '../../../../shared/types/events';

const QUEUE = 'user.registered';

export async function publishUserRegistered(event: UserRegisteredEvent): Promise<void> {
  const channel = await getRabbitChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(event)));
}
