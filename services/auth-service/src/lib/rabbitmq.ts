import amqplib, { Channel } from 'amqplib';

let channel: Channel | null = null;

export async function getRabbitChannel(): Promise<Channel> {
  if (channel) return channel;

  const connection = await amqplib.connect(process.env.RABBITMQ_URL!);
  channel = await connection.createChannel();

  return channel;
}
