import apiClient from "../lib/apiClient";
import type { RoleLog } from "../types/roleLog";

export async function getRoleLogs(): Promise<RoleLog[]> {
    const res = await apiClient.get<RoleLog[]>("/logs/roles");
    return res.data;
}
