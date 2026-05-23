import { useState } from 'react';
import apiClient from '../lib/apiClient';


interface User {
  sub: string;
  email: string;
  roles: string[];
};

function parseJwt(token: string) {
    return JSON.parse(atob(token.split('.')[1]));
}

function isTokenExpiringSoon(token: string): boolean {
    try {
        const { exp } = parseJwt(token);
        return exp * 1000 - Date.now() < 2 * 60 * 1000;
    } catch {
        return true;
    }
}

export async function getAccessToken(): Promise<string | null> {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');

    if (!accessToken || !refreshToken) return null;

    if (!isTokenExpiringSoon(accessToken)) return accessToken;

    try {
        const res = await apiClient.post<{ accessToken: string }>('/auth/refresh', { refreshToken });
        localStorage.setItem('accessToken', res.data.accessToken);
        return res.data.accessToken;
    } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        return null;
    }
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(() => {
        const accessToken = localStorage.getItem('accessToken');
        if (!accessToken) return null;

        try {
            return parseJwt(accessToken);
        } catch {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            return null;
        }
    });

    const logout = async () => {
        const refreshToken = localStorage.getItem('refreshToken');

        if (refreshToken) {
            await apiClient.post('/auth/logout', { refreshToken }).catch(() => {});
        }

        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setUser(null);
        window.location.href = '/login';
    };

    return { user, logout };
}