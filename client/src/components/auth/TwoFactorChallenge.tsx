import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useVerifyLogin } from "../../hooks/useTwoFactor";
import { getErrorMessage } from "../../lib/errors";

// Login step two: one input that accepts either the 6-digit authenticator code
// or a one-time recovery code. The backend decides which it is.
export default function TwoFactorChallenge({ tempToken }: { tempToken: string }) {
    const [code, setCode] = useState("");
    const [useRecovery, setUseRecovery] = useState(false);
    const { mutate: verify, isPending, error } = useVerifyLogin(tempToken);

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
                    verify(code);
                }}
                className="space-y-4"
            >
                <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={useRecovery ? "xxxx-xxxx-xxxx" : "123456"}
                    autoFocus
                />

                {error && <p className="text-sm text-red-500">{getErrorMessage(error)}</p>}

                <Button type="submit" className="w-full" disabled={!code || isPending}>
                    {isPending ? "Verifying..." : "Verify"}
                </Button>
            </form>

            <button
                type="button"
                onClick={() => {
                    setUseRecovery((v) => !v);
                    setCode("");
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
