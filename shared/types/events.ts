export interface UserRegisteredEvent {
  userId: number;
  name: string;
  email: string;
}

export interface SellerApprovedEvent {
  userId: number;
}
