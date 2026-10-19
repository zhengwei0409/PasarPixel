import { useSyncExternalStore } from 'react';
import apiClient from '../lib/apiClient';
import { clearAuthSession, getAuthUser, getSessionKey, subscribeToAuth } from '../lib/authSession';

async function logout() {
    const refreshToken = getSessionKey();
    clearAuthSession();
    if (refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken }, { timeout: 10_000 }).catch(() => {});
    }
    window.location.href = '/login';
}

export function useAuth() {
    const user = useSyncExternalStore(subscribeToAuth, getAuthUser, () => null);
    return { user, logout };
}
