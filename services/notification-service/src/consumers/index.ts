import { startUserRegisteredConsumer } from './userRegistered';

export async function startConsumers(): Promise<void> {
    await startUserRegisteredConsumer();
}
