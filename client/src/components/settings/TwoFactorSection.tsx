import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    useTwoFactorStatus,
    useSetupTwoFactor,
    useEnableTwoFactor,
    useDisableTwoFactor,
} from "@/hooks/useTwoFactor";

// Local flow stages for turning 2FA on.
type Stage = "idle" | "scanning";

export default function TwoFactorSection() {
    const { data: status, isLoading } = useTwoFactorStatus();
    const setup = useSetupTwoFactor();
    const enable = useEnableTwoFactor();
    const disable = useDisableTwoFactor();

    const [stage, setStage] = useState<Stage>("idle");
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [code, setCode] = useState("");
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
    const [confirmDisable, setConfirmDisable] = useState(false);

    function resetFlow() {
        setStage("idle");
        setQrCode(null);
        setCode("");
        setRecoveryCodes([]);
    }

    function handleStartSetup() {
        setup.mutate(undefined, {
            onSuccess: (data) => {
                setQrCode(data.qrCode);
                setStage("scanning");
            },
        });
    }

    function handleVerify() {
        enable.mutate(code, {
            onSuccess: (data) => {
                // Clear the scanning UI; the recovery codes drive their own dialog.
                setStage("idle");
                setQrCode(null);
                setCode("");
                setRecoveryCodes(data.recoveryCodes);
            },
        });
    }

    function handleCopyCodes() {
        navigator.clipboard.writeText(recoveryCodes.join("\n"));
    }

    function handleDownloadCodes() {
        const blob = new Blob([recoveryCodes.join("\n")], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "pasarpixel-recovery-codes.txt";
        link.click();
        URL.revokeObjectURL(url);
    }

    return (
        <section className="mt-6 rounded-lg border p-5">
            <h2 className="text-sm font-medium">Two-factor authentication</h2>
            <p className="mb-4 text-xs text-muted-foreground">
                Add an extra step at login using an authenticator app such as Google
                Authenticator or Authy.
            </p>

            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

            {/* ENABLED: offer to disable */}
            {!isLoading && status?.enabled && stage === "idle" && (
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-600">
                        2FA is enabled
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDisable(true)}
                    >
                        Disable 2FA
                    </Button>
                </div>
            )}

            {/* DISABLED: offer to enable */}
            {!isLoading && !status?.enabled && stage === "idle" && (
                <Button size="sm" onClick={handleStartSetup} disabled={setup.isPending}>
                    {setup.isPending ? "Preparing…" : "Enable 2FA"}
                </Button>
            )}

            {/* SCANNING: show QR + verify code */}
            {stage === "scanning" && qrCode && (
                <div className="space-y-4">
                    <p className="text-sm">
                        Scan this QR code with your authenticator app, then enter the
                        6-digit code it shows.
                    </p>
                    <img src={qrCode} alt="2FA QR code" className="h-44 w-44" />
                    <div className="flex items-center gap-2">
                        <Input
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="123456"
                            className="w-40"
                        />
                        <Button
                            size="sm"
                            onClick={handleVerify}
                            disabled={!code || enable.isPending}
                        >
                            {enable.isPending ? "Verifying…" : "Verify"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={resetFlow}>
                            Cancel
                        </Button>
                    </div>
                    {enable.isError && (
                        <p className="text-sm text-red-600">
                            Invalid code. Please try again.
                        </p>
                    )}
                </div>
            )}

            {/* RECOVERY CODES: shown once, in a dialog driven by the codes array */}
            <Dialog
                open={recoveryCodes.length > 0}
                onOpenChange={(open) => {
                    if (!open) setRecoveryCodes([]);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save your recovery codes</DialogTitle>
                        <DialogDescription>
                            Each code can be used once to log in if you lose your
                            device. They will not be shown again.
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm">
                        {recoveryCodes.map((rc) => (
                            <li key={rc}>{rc}</li>
                        ))}
                    </ul>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCopyCodes}>
                            Copy
                        </Button>
                        <Button variant="outline" onClick={handleDownloadCodes}>
                            Download
                        </Button>
                        <Button onClick={() => setRecoveryCodes([])}>OK</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmDisable} onOpenChange={setConfirmDisable}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Disable two-factor authentication?</DialogTitle>
                        <DialogDescription>
                            Your authenticator setup and recovery codes will be erased.
                            You'll need to set up 2FA again from scratch to turn it
                            back on.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setConfirmDisable(false)}
                            disabled={disable.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() =>
                                disable.mutate(undefined, {
                                    onSuccess: () => setConfirmDisable(false),
                                })
                            }
                            disabled={disable.isPending}
                        >
                            {disable.isPending ? "Disabling…" : "Disable 2FA"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
