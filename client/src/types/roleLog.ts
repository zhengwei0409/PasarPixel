export type RoleChangeAction = "GRANT" | "REVOKE";

export interface RoleLogUser {
    userId: number;
    name: string | null;
    email: string | null;
}

export interface RoleLog {
    id: number;
    action: RoleChangeAction;
    role: string;
    reason: string | null;
    createdAt: string;
    targetUser: RoleLogUser;
    admin: RoleLogUser;
}
