import apiClient from "../lib/apiClient";
import type { Order, OrdersParams, OrdersResponse } from "../types/order";

export async function getOrders(params: OrdersParams = {}): Promise<OrdersResponse> {
    const res = await apiClient.get<OrdersResponse>("/orders", { params });
    return res.data;
}

export async function getOrderById(id: number): Promise<Order> {
    const res = await apiClient.get<Order>(`/orders/${id}`);
    return res.data;
}
