export const ADMIN_PAYMENT_STATUSES = ["PENDING", "COMPLETED", "FAILED", "REFUNDED"] as const;
export const ADMIN_PAYMENT_METHODS = ["STRIPE", "SOL"] as const;

type PaymentStatus = typeof ADMIN_PAYMENT_STATUSES[number];
type PaymentMethod = typeof ADMIN_PAYMENT_METHODS[number];

export interface AdminTransaction {
    id: number;
    account: { userId: number; name: string; email: string | null };
    amount: string;
    createdAt: string;
    updatedAt: string;
    kind: "purchase";
    status: PaymentStatus;
    method: PaymentMethod;
    currency: "USD" | "MYR";
    totalLamports: string | null;
    reference: string | null;
    referenceLabel: "Stripe session ID" | "Solana signature" | "Purchase reference";
    itemCount: number;
}

export interface AdminTransactionFilters {
    page: number;
    search?: string;
    status?: PaymentStatus;
    method?: PaymentMethod;
}

export interface AdminTransactionsResponse {
    items: AdminTransaction[];
    total: number;
    page: number;
    pageSize: number;
}
