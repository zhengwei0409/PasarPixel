import { useMutation, useQuery } from "@tanstack/react-query";
import {
    getOrders,
    getOrderById,
    downloadOrder,
    downloadCertificate,
    verifyLicense,
} from "../services/orderService";
import type { OrdersParams } from "../types/order";

export function useOrders(params: OrdersParams = {}) {
    return useQuery({
        queryKey: ["orders", params],
        queryFn: () => getOrders(params),
    });
}

export function useOrder(id: number) {
    return useQuery({
        queryKey: ["orders", id],
        queryFn: () => getOrderById(id),
        enabled: Number.isInteger(id) && id > 0,
    });
}

export function useDownloadOrder() {
    return useMutation({
        mutationFn: (id: number) => downloadOrder(id),
    });
}

// FR-3.5: download the PDF certificate for a single purchased item.
export function useDownloadCertificate() {
    return useMutation({
        mutationFn: (vars: {
            orderId: number;
            itemId: number;
            licenseKey: string;
        }) => downloadCertificate(vars.orderId, vars.itemId, vars.licenseKey),
    });
}

// FR-3.5: triggered when the visitor submits a key on the public /verify page,
// so a mutation fits better than a query that runs on mount.
export function useVerifyLicense() {
    return useMutation({
        mutationFn: (licenseKey: string) => verifyLicense(licenseKey),
    });
}
