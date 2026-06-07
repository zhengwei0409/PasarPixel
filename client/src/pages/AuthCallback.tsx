import { useEffect, useState } from "react";
import { finishLogin } from "../lib/finishLogin";
import TwoFactorChallenge from "../components/auth/TwoFactorChallenge";

export default function AuthCallback() {
    const [tempToken, setTempToken] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get("accessToken");
        const refreshToken = params.get("refreshToken");
        const twoFactorRequired = params.get("twoFactorRequired");
        const incomingTempToken = params.get("tempToken");

        if (twoFactorRequired && incomingTempToken) {
            setTempToken(incomingTempToken);
        } else if (accessToken && refreshToken) {
            finishLogin({ accessToken, refreshToken });
        } else {
            window.location.href = "/login";
        }
    }, []);

    if (tempToken) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <TwoFactorChallenge tempToken={tempToken} />
            </div>
        );
    }

    return <div>Logging you in...</div>;
}
