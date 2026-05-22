import { getRabbitChannel } from './rabbitmq';
import { prisma } from './prisma';
import { UserRegisteredEvent } from '../../../../shared/types/events';
import { EXCHANGE_USER_REGISTERED } from '../../../../shared/utils/messaging';

const QUEUE = 'user.registered.main-api';

export async function startConsumer(): Promise<void> {
  const channel = await getRabbitChannel();
  await channel.assertExchange(EXCHANGE_USER_REGISTERED, 'fanout', { durable: true });
  await channel.assertQueue(QUEUE, { durable: true });
  await channel.bindQueue(QUEUE, EXCHANGE_USER_REGISTERED, '');

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    const event: UserRegisteredEvent = JSON.parse(msg.content.toString());

    await prisma.userProfile.upsert({
      where: { userId: event.userId },
      update: { email: event.email },
      create: {
        userId: event.userId,
        name: event.name,
        email: event.email,
      },
    });

    channel.ack(msg);
  });

  console.log(`Consumer listening on queue: ${QUEUE}`);
}
