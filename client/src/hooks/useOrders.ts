import { useMutation, useQuery } from "@tanstack/react-query";
import {
    getOrders,
    getOrderById,
    downloadOrder,
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
