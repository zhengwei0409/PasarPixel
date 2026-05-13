import { useState, useEffect } from 'react';

interface User {
  id: string
  email: string
  name: string
};

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setUser(payload);
        } catch {
            localStorage.removeItem('token');
        }
    }, [])

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        window.location.href = '/login';
    }

    return { user, logout};
}