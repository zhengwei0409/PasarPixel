export interface UserRegisteredEvent {
  userId: number;
  name: string;
  email: string;
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

// Admin revoked a user's SELLER role -> auth-service drops the role
export interface SellerRevokedEvent {
  userId: number;
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
