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

export interface PasswordResetEvent {
  userId: number;
  email: string;
  resetToken: string;
}
