import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyApplication, submitApplication, listApplications, approveApplication, rejectApplication, revokeSeller } from "../services/sellerApplicationService";
import type { SubmitApplicationPayload } from "../types/sellerApplication";

export function useMyApplication() {
    return useQuery({
        queryKey: ["sellerApplication", "me"],
        queryFn: getMyApplication,
        retry: false,
    });
}

export function useSubmitApplication() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: SubmitApplicationPayload) => submitApplication(payload),
        onSuccess: (data) => {
            queryClient.setQueryData(["sellerApplication", "me"], data);
        },
    });
}

export function useListApplications(status?: string) {
    return useQuery({
        queryKey: ["sellerApplications", status],
        queryFn: () => listApplications(status),
    });
}

export function useApproveApplication() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => approveApplication(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sellerApplications"] });
        },
    });
}

export function useRejectApplication() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, adminNote }: { id: number; adminNote: string }) => rejectApplication(id, adminNote),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sellerApplications"] });
        },
    });
}

export function useRevokeSeller() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (userId: number) => revokeSeller(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sellerApplications"] });
        },
    });
}
