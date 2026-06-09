import { startUserRegisteredConsumer } from './userRegistered';
import { startPasswordResetConsumer } from './passwordReset';
import { startSellerApprovedConsumer } from './sellerApproved';
import { startSellerRejectedConsumer } from './sellerRejected';
import { startSellerRevokedConsumer } from './sellerRevoked';
import { startSellerReinstatedConsumer } from './sellerReinstated';
import { startAssetApprovedConsumer } from './assetApproved';
import { startAssetRejectedConsumer } from './assetRejected';
import { startAssetRemovedConsumer } from './assetRemoved';
import { startOrderPaidConsumer } from './orderPaid';
import { startAssetSoldConsumer } from './assetSold';
import { startReviewReceivedConsumer } from './reviewReceived';
import { startUserDeletedConsumer } from './userDeleted';

export async function startConsumers(): Promise<void> {
    await startUserRegisteredConsumer();
    await startPasswordResetConsumer();
    await startSellerApprovedConsumer();
    await startSellerRejectedConsumer();
    await startSellerRevokedConsumer();
    await startSellerReinstatedConsumer();
    await startAssetApprovedConsumer();
    await startAssetRejectedConsumer();
    await startAssetRemovedConsumer();
    await startOrderPaidConsumer();
    await startAssetSoldConsumer();
    await startReviewReceivedConsumer();
    await startUserDeletedConsumer();
}
