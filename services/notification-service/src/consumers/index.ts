import { startUserRegisteredConsumer } from './userRegistered';
import { startPasswordResetConsumer } from './passwordReset';

export async function startConsumers(): Promise<void> {
    await startUserRegisteredConsumer();
    await startPasswordResetConsumer();
}
