import axios from 'axios';
import type { AuthTokens } from '../types/auth';
import { queryClient } from './queryClient';

interface User {
    sub: string;
    email: string;
    roles: string[];
    exp: number;
}

// Refresh uses a separate client so it cannot recurse through auth interceptors.
const refreshClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
    timeout: 15_000,
});
const listeners = new Set<() => void>();
let snapshotKey: string | null = null;
let snapshot: User | null = null;
let pendingRefresh: { token: string; promise: Promise<string | null> } | null = null;
let observedSessionKey = localStorage.getItem('refreshToken');

function parseUser(token: string): User | null {
    try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
        const user = JSON.parse(new TextDecoder().decode(bytes));
        if (!user.sub || typeof user.email !== 'string' || !Array.isArray(user.roles)
            || !user.roles.every((role: unknown) => typeof role === 'string')
            || typeof user.exp !== 'number' || !Number.isFinite(user.exp)) return null;
        return { sub: String(user.sub), email: user.email, roles: user.roles, exp: user.exp };
    } catch {
        return null;
    }
}

export function getSessionKey(): string | null {
    return localStorage.getItem('refreshToken');
}

export function getAuthUser(): User | null {
    const token = localStorage.getItem('accessToken');
    const key = token && getSessionKey() ? token : null;
    if (key !== snapshotKey) {
        snapshotKey = key;
        snapshot = key ? parseUser(key) : null;
    }
    return snapshot;
}

function notify() {
    observedSessionKey = getSessionKey();
    listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
    if (event.storageArea !== localStorage) return;
    if (event.key === null || event.key === 'accessToken' || event.key === 'refreshToken') {
        if (getSessionKey() !== observedSessionKey) queryClient.clear();
        notify();
    }
}

export function subscribeToAuth(listener: () => void) {
    listeners.add(listener);
    if (listeners.size === 1) window.addEventListener('storage', onStorage);
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener('storage', onStorage);
    };
}

export function setAuthTokens(tokens: AuthTokens) {
    if (!parseUser(tokens.accessToken)) throw new Error('Invalid access token');
    const changedSession = getSessionKey() !== tokens.refreshToken;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    if (changedSession) queryClient.clear();
    notify();
}

export function clearAuthSession() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    queryClient.clear();
    notify();
}

export async function refreshAuthSession(): Promise<string | null> {
    const refreshToken = getSessionKey();
    if (!refreshToken) return null;
    if (pendingRefresh?.token === refreshToken) return pendingRefresh.promise;

    const promise = (async () => {
        try {
            const { data } = await refreshClient.post<{ accessToken: string }>('/auth/refresh', { refreshToken });
            // A slow response must never restore a logged-out or replaced session.
            if (getSessionKey() !== refreshToken) return null;
            setAuthTokens({ accessToken: data.accessToken, refreshToken });
            return data.accessToken;
        } catch (error) {
            if (getSessionKey() !== refreshToken) return null;
            if (axios.isAxiosError(error) && [400, 401].includes(error.response?.status ?? 0)) {
                clearAuthSession();
                return null;
            }
            // Offline, timeout and server errors should surface without erasing login.
            throw error;
        }
    })();
    pendingRefresh = { token: refreshToken, promise };
    try {
        return await promise;
    } finally {
        if (pendingRefresh?.promise === promise) pendingRefresh = null;
    }
}

export async function getAccessToken(): Promise<string | null> {
    if (!getSessionKey()) return null;
    const token = localStorage.getItem('accessToken');
    const user = token ? parseUser(token) : null;
    if (user && user.exp * 1000 - Date.now() >= 2 * 60 * 1000) return token;
    return refreshAuthSession();
}
