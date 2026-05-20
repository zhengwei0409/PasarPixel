import { getRabbitChannel } from './rabbitmq';
import { prisma } from './prisma';
import { UserRegisteredEvent } from '../../../../shared/types/events';

const QUEUE = 'user.registered';

export async function startConsumer(): Promise<void> {
  const channel = await getRabbitChannel();
  await channel.assertQueue(QUEUE, { durable: true });

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    const event: UserRegisteredEvent = JSON.parse(msg.content.toString());

    await prisma.userProfile.upsert({
      where: { userId: event.userId },
      update: {},
      create: {
        userId: event.userId,
        name: event.name,
      },
    });

    channel.ack(msg);
  });

  console.log('Consumer listening on queue: user.registered');
}
