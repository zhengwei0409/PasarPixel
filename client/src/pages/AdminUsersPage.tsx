import { useState } from "react";
import { Button } from "../components/ui/button";
import { useUsers, useDeleteUser } from "../hooks/useUsers";
import { useAuth } from "../hooks/useAuth";
import type { AdminUser } from "../types/user";

export default function AdminUsersPage() {
    const [confirmingId, setConfirmingId] = useState<number | null>(null);

    const { user } = useAuth();
    const currentUserId = user ? Number(user.sub) : null;

    const { data: users, isLoading } = useUsers();
    const { mutate: remove, isPending: isDeleting } = useDeleteUser();

    const handleDelete = (userId: number) => {
        remove(userId);
        setConfirmingId(null);
    };

    if (isLoading) return <p className="p-8">Loading...</p>;

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-6">
            <h1 className="text-2xl font-bold">Manage Users</h1>

            {users?.length === 0 && <p className="text-gray-500">No users.</p>}

            {users?.map((u: AdminUser) => (
                <div key={u.userId} className="border rounded-lg p-6 space-y-3">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="font-semibold">{u.name}</p>
                            <p className="text-sm text-gray-500">{u.email ?? "—"}</p>
                        </div>
                        <p className="text-sm text-gray-400">
                            Joined {new Date(u.createdAt).toLocaleDateString()}
                        </p>
                    </div>

                    {u.userId === currentUserId ? (
                        <p className="text-sm text-gray-400 pt-2">This is you.</p>
                    ) : confirmingId === u.userId ? (
                        <div className="space-y-2 pt-2">
                            <p className="text-sm text-red-600">
                                Permanently delete this user and all their data (listings, orders,
                                files)? This cannot be undone.
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDelete(u.userId)}
                                    disabled={isDeleting}
                                >
                                    Confirm Delete
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setConfirmingId(null)}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-2 pt-2">
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setConfirmingId(u.userId)}
                            >
                                Delete User
                            </Button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
