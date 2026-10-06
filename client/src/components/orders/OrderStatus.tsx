import type { PaymentStatus } from "@/types/order";

const statuses: Record<PaymentStatus, { label: string; className: string }> = {
    COMPLETED: { label: "Completed", className: "bg-[#edf1e6] text-[#536442]" },
    PENDING: { label: "Pending", className: "bg-[#f6efdf] text-[#886928]" },
    FAILED: { label: "Failed", className: "bg-[#f8eae6] text-[#9b5141]" },
    REFUNDED: { label: "Refunded", className: "bg-[#eceee7] text-[#656c5d]" },
};

export default function OrderStatus({ status }: { status: PaymentStatus }) {
    const { label, className } = statuses[status];
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${className}`}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {label}
        </span>
    );
}
