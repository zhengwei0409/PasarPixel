export interface UserRegisteredEvent {
  userId: number;
  name: string;
  email: string;
}

// Admin deleted a user in main-api -> auth-service deletes the account,
// notification-service deletes the user's notifications
export interface UserDeletedEvent {
  userId: number;
}

export interface SellerApprovedEvent {
  userId: number;
  email: string;
  storeName: string;
}

export interface SellerRejectedEvent {
  userId: number;
  email: string;
  storeName: string;
  adminNote?: string;
}

// Admin revoked a user's SELLER role -> auth-service drops the role,
// notification-service tells the seller
export interface SellerRevokedEvent {
  userId: number;
  email: string;
  storeName: string;
  adminNote: string;
}

// Admin undid a revoke -> auth-service grants the SELLER role back,
// notification-service tells the seller
export interface SellerReinstatedEvent {
  userId: number;
  email: string;
  storeName: string;
}

export interface PasswordResetEvent {
  userId: number;
  email: string;
  resetToken: string;
}

// Admin approved a seller's asset -> notify the seller
export interface AssetApprovedEvent {
  sellerId: number;
  assetId: number;
  assetTitle: string;
}

// Admin rejected a seller's asset -> notify the seller
export interface AssetRejectedEvent {
  sellerId: number;
  assetId: number;
  assetTitle: string;
  rejectionReason?: string;
}

// A published asset was taken down -> notify the seller
export interface AssetRemovedEvent {
  sellerId: number;
  assetId: number;
  assetTitle: string;
  reason?: string; // why it was taken down (e.g. admin takedown via a report)
}

// A buyer's order was paid successfully -> notify the buyer
export interface OrderPaidEvent {
  buyerId: number;
  orderId: number;
  itemCount: number;
}

// One of a seller's assets was sold in a paid order -> notify the seller
export interface AssetSoldEvent {
  sellerId: number;
  assetId: number;
  assetTitle: string;
  orderId: number;
}

// A buyer left a review on a seller's asset -> notify the seller
export interface ReviewReceivedEvent {
  sellerId: number;
  assetId: number;
  assetTitle: string;
  rating: number;
}
