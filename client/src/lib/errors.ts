import { AxiosError } from "axios";

export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
    if (error instanceof AxiosError) {
        return error.response?.data?.error ?? fallback;
    }
    return fallback;
}
