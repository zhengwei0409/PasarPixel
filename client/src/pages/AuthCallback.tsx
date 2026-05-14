import { useEffect } from "react";

export default function AuthCallback() {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get('accessToken');
        const refreshToken = params.get('refreshToken');

        if (accessToken && refreshToken) {
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            window.location.href = '/dashboard';
        } else {
            window.location.href = '/login';
        }
    }, []);

    return <div>Logging you in...</div>
}