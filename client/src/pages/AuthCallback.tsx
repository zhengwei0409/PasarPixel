import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { finishLogin } from "../lib/finishLogin";
import TwoFactorChallenge from "../components/auth/TwoFactorChallenge";
import { ACCOUNT_SUSPENDED_CODE } from "../../../shared/types/adminAccount";

export default function AuthCallback() {
    const navigate = useNavigate();
    const { search } = useLocation();
    const params = new URLSearchParams(search);
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    const tempToken = params.get("twoFactorRequired") === "true" ? params.get("tempToken") : null;
    const suspended = params.get("error") === ACCOUNT_SUSPENDED_CODE;

    useEffect(() => {
        if (tempToken) return;
        if (accessToken && refreshToken) {
            finishLogin({ accessToken, refreshToken });
        } else {
            navigate("/login", { replace: true, state: suspended ? { suspended: true } : undefined });
        }
    }, [accessToken, refreshToken, tempToken, suspended, navigate]);

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
