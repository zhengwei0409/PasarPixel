export type NotificationType =
    | "WELCOME" | "PASSWORD_RESET" | "SELLER_APPROVED" | "SELLER_REJECTED"
    | "ACCOUNT_SUSPENDED" | "ACCOUNT_UNSUSPENDED";

export interface Notification {
    id: number;
    userId: number;
    type: NotificationType;
    title: string;
    body: string;
    readAt: string | null;
    createdAt: string;
}
