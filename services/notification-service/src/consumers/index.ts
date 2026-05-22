import { startUserRegisteredConsumer } from './userRegistered';
import { startPasswordResetConsumer } from './passwordReset';
import { startSellerApprovedConsumer } from './sellerApproved';
import { startSellerRejectedConsumer } from './sellerRejected';

export async function startConsumers(): Promise<void> {
    await startUserRegisteredConsumer();
    await startPasswordResetConsumer();
    await startSellerApprovedConsumer();
    await startSellerRejectedConsumer();
}
