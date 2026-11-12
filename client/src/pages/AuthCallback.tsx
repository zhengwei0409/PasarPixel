import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { finishLogin } from "../lib/finishLogin";
import TwoFactorChallenge from "../components/auth/TwoFactorChallenge";

export default function AuthCallback() {
    const navigate = useNavigate();
    const { search } = useLocation();
    const params = new URLSearchParams(search);
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    const tempToken = params.get("twoFactorRequired") === "true" ? params.get("tempToken") : null;

    useEffect(() => {
        if (tempToken) return;
        if (accessToken && refreshToken) {
            finishLogin({ accessToken, refreshToken });
        } else {
            navigate("/login", { replace: true });
        }
    }, [accessToken, refreshToken, tempToken, navigate]);

    if (tempToken) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <TwoFactorChallenge
                    key={tempToken}
                    challenge={{
                        twoFactorRequired: true,
                        tempToken,
                        attemptsRemaining: Number(params.get("attemptsRemaining") ?? 5),
                        lockedUntil: params.get("lockedUntil"),
                    }}
                    onRestart={() => navigate("/login", { replace: true })}
                />
            </div>
        );
    }

    return <div>Logging you in...</div>;
}
