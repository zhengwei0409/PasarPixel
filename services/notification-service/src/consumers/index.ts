import { startUserRegisteredConsumer } from './userRegistered';
import { startPasswordResetConsumer } from './passwordReset';
import { startSellerApprovedConsumer } from './sellerApproved';
import { startSellerRejectedConsumer } from './sellerRejected';
import { startAssetApprovedConsumer } from './assetApproved';
import { startAssetRejectedConsumer } from './assetRejected';
import { startAssetRemovedConsumer } from './assetRemoved';

export async function startConsumers(): Promise<void> {
    await startUserRegisteredConsumer();
    await startPasswordResetConsumer();
    await startSellerApprovedConsumer();
    await startSellerRejectedConsumer();
    await startAssetApprovedConsumer();
    await startAssetRejectedConsumer();
    await startAssetRemovedConsumer();
}
