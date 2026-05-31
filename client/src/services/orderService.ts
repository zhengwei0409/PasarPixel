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

// FR-3.4: fetch a short-lived signed link, download the ZIP as a blob, then
// trigger a browser save. Keeping the token out of the address bar.
export async function downloadOrder(id: number): Promise<void> {
    const { data } = await apiClient.get<{ url: string }>(
        `/orders/${id}/download-url`
    );

    const res = await apiClient.get<Blob>(data.url, { responseType: "blob" });

    const objectUrl = URL.createObjectURL(res.data);
    try {
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `order-${id}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}
