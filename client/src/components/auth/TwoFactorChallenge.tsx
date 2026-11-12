import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useVerifyLogin } from "../../hooks/useTwoFactor";
import { getErrorMessage } from "../../lib/errors";
import type { TwoFactorChallenge as LoginChallenge, TwoFactorVerificationError } from "../../types/auth";

export default function TwoFactorChallenge({ challenge, onRestart }: {
    challenge: LoginChallenge;
    onRestart: () => void;
}) {
    const [code, setCode] = useState("");
    const [useRecovery, setUseRecovery] = useState(false);
    const [attemptsRemaining, setAttemptsRemaining] = useState(challenge.attemptsRemaining);
    const [lockedUntil, setLockedUntil] = useState(() => Date.parse(challenge.lockedUntil ?? "") || 0);
    const [now, setNow] = useState(Date.now);
    const { mutate: verify, isPending, error, reset } = useVerifyLogin(challenge.tempToken);
    const verificationError = isAxiosError<TwoFactorVerificationError>(error) ? error.response?.data : undefined;

    useEffect(() => {
        if (!lockedUntil) return;
        const timer = window.setInterval(() => {
            const currentTime = Date.now();
            setNow(currentTime);
            if (currentTime >= lockedUntil) window.clearInterval(timer);
        }, 1000);
        return () => window.clearInterval(timer);
    }, [lockedUntil]);

    const secondsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
    const restartRequired = lockedUntil > 0 || verificationError?.code === "TWO_FACTOR_CHALLENGE_EXPIRED";
    const showAttempts = attemptsRemaining > 0 && attemptsRemaining < 5;

    if (restartRequired) {
        const minutes = Math.floor(secondsLeft / 60);
        const seconds = String(secondsLeft % 60).padStart(2, "0");
        return (
            <div className="w-full max-w-sm space-y-4">
                <h1 className="text-2xl font-bold">Two-factor authentication</h1>
                {secondsLeft > 0 ? (
                    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                        <p role="status">Too many incorrect codes. Two-factor sign-in is temporarily locked.</p>
                        <p>Sign in again in <span className="font-semibold tabular-nums">{minutes}:{seconds}</span>.</p>
                    </div>
                ) : (
                    <>
                        <p role="status" className="text-sm text-gray-600">
                            {lockedUntil > 0
                                ? "You can try again. Sign in to enter a new code."
                                : "Your sign-in session has expired. Sign in again to continue."}
                        </p>
                        <Button type="button" className="w-full" onClick={onRestart}>Sign in again</Button>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="w-full max-w-sm space-y-4">
            <h1 className="text-2xl font-bold">Two-factor authentication</h1>
            <p className="text-sm text-gray-500">
                {useRecovery
                    ? "Enter one of your recovery codes."
                    : "Enter the 6-digit code from your authenticator app."}
            </p>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!code.trim() || isPending) return;
                    verify(code.trim(), {
                        onError: (failure) => {
                            if (!isAxiosError<TwoFactorVerificationError>(failure)) return;
                            const details = failure.response?.data;
                            if (typeof details?.attemptsRemaining === "number") {
                                setAttemptsRemaining(details.attemptsRemaining);
                            }
                            if (details?.lockedUntil) {
                                setNow(Date.now());
                                setLockedUntil(Date.parse(details.lockedUntil));
                            }
                        },
                    });
                }}
                className="space-y-4"
                aria-busy={isPending}
            >
                <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    aria-label={useRecovery ? "Recovery code" : "Authenticator code"}
                    aria-describedby="two-factor-feedback"
                    aria-invalid={typeof verificationError?.attemptsRemaining === "number"}
                    inputMode={useRecovery ? "text" : "numeric"}
                    autoComplete={useRecovery ? "off" : "one-time-code"}
                    placeholder={useRecovery ? "xxxx-xxxx-xxxx" : "123456"}
                    autoFocus
                />

                <div id="two-factor-feedback" role="status" className="empty:hidden text-sm text-red-700">
                    {error && <p>{getErrorMessage(error)}</p>}
                    {showAttempts && (
                        <p className="font-medium">
                            {attemptsRemaining} {attemptsRemaining === 1 ? "attempt" : "attempts"} left.
                        </p>
                    )}
                </div>

                <Button type="submit" className="w-full" disabled={!code.trim() || isPending}>
                    {isPending ? "Verifying..." : "Verify"}
                </Button>
            </form>

            <button
                type="button"
                disabled={isPending}
                onClick={() => {
                    setUseRecovery((v) => !v);
                    setCode("");
                    reset();
                }}
                className="text-sm text-gray-500 underline"
            >
                {useRecovery
                    ? "Use your authenticator app instead"
                    : "Use a recovery code instead"}
            </button>
        </div>
    );
}
