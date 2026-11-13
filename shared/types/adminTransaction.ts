export const ADMIN_PAYMENT_STATUSES = ["PENDING", "COMPLETED", "FAILED", "REFUNDED"] as const;
export const ADMIN_PAYMENT_METHODS = ["STRIPE", "SOL"] as const;
export const ADMIN_WITHDRAWAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "PAID"] as const;

type PaymentStatus = typeof ADMIN_PAYMENT_STATUSES[number];
type PaymentMethod = typeof ADMIN_PAYMENT_METHODS[number];
type WithdrawalStatus = typeof ADMIN_WITHDRAWAL_STATUSES[number];

interface TransactionBase {
    id: number;
    account: { userId: number; name: string; email: string | null };
    amount: string;
    createdAt: string;
    updatedAt: string;
}

export type AdminTransaction = TransactionBase & ({
    kind: "purchase";
    status: PaymentStatus;
    method: PaymentMethod;
    currency: "USD" | "MYR";
    totalLamports: string | null;
    reference: string | null;
    referenceLabel: "Stripe session ID" | "Solana signature" | "Purchase reference";
    itemCount: number;
} | {
    kind: "withdrawal";
    status: WithdrawalStatus;
    currency: "USD";
});

export type AdminTransactionFilters = { page: number; search?: string } & ({
    kind: "purchase";
    status?: PaymentStatus;
    method?: PaymentMethod;
} | {
    kind: "withdrawal";
    status?: WithdrawalStatus;
});

export interface AdminTransactionsResponse {
    items: AdminTransaction[];
    total: number;
    page: number;
    pageSize: number;
}
