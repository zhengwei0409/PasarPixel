import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { listUsers, getUserDetail, deleteUser, updateAccountSuspension } from "../services/userService";
import type { AdminUser } from "../types/user";
import type { AdminUserDetail } from "../../../shared/types/adminUserDetail";

export function useUsers() {
    return useQuery({
        queryKey: ["users"],
        queryFn: listUsers,
    });
}

export function useUserDetail(userId: number, activityPage = 1) {
    return useQuery({
        queryKey: ["users", userId, activityPage],
        queryFn: ({ signal }) => getUserDetail(userId, activityPage, signal),
        placeholderData: keepPreviousData,
        gcTime: 0,
        retry: (failures, error) => {
            const status = isAxiosError(error) ? error.response?.status : undefined;
            return failures < 1 && (status === undefined || status >= 500);
        },
    });
}

export function useDeleteUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, reason }: { userId: number; reason: string }) => deleteUser(userId, reason),
        onSuccess: (_, { userId }) => {
            queryClient.removeQueries({ queryKey: ["users", userId] });
            queryClient.invalidateQueries({ queryKey: ["users"] });
        },
    });
}

export function useUpdateAccountSuspension() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, suspended, reason }: { userId: number; suspended: boolean; reason: string }) =>
            updateAccountSuspension(userId, suspended, reason),
        onSuccess: (account) => {
            queryClient.setQueryData<AdminUser[]>(["users"], (users) =>
                users?.map((user) => user.userId === account.userId ? { ...user, ...account } : user));
            queryClient.setQueriesData<AdminUserDetail>({ queryKey: ["users", account.userId] }, (detail) =>
                detail && { ...detail, account: { ...detail.account, ...account } });
            void queryClient.invalidateQueries({ queryKey: ["users"] });
        },
        onError: (error) => {
            if (isAxiosError(error) && [404, 409].includes(error.response?.status ?? 0)) {
                void queryClient.invalidateQueries({ queryKey: ["users"] });
            }
        },
    });
}
