import { useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    const { data: status, isLoading, isError, refetch } = useTwoFactorStatus();
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
        enable.reset();
    }

    function handleStartSetup() {
        setup.reset();
        enable.reset();
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
        const blob = new Blob([recoveryCodes.join("\n")], {
            type: "text/plain",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "pasarpixel-recovery-codes.txt";
        link.click();
        URL.revokeObjectURL(url);
    }

    return (
        <section
            aria-labelledby="security-heading"
            className="rounded-xl border border-[#e7e9e1] bg-white p-6 shadow-[0_2px_4px_-3px_rgba(37,40,35,0.15)] sm:p-9"
        >
            <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#e9ecdf] text-[#657152]">
                    <ShieldCheck className="size-5" aria-hidden="true" />
                </div>
                <div>
                    <p className="mb-2 text-[10px] font-medium tracking-[0.18em] text-[#73776e] uppercase">
                        Security
                    </p>
                    <h2
                        id="security-heading"
                        className="text-xl font-semibold tracking-[-0.03em]"
                    >
                        Two-factor authentication
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[#73776e]">
                        Add an extra layer of protection with a code from your
                        authenticator app when you sign in.
                    </p>
                </div>
            </div>

            {isLoading && (
                <p
                    role="status"
                    className="mt-7 flex items-center gap-2 text-sm text-muted-foreground"
                >
                    <Loader2
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                    />{" "}
                    Checking your security settings…
                </p>
            )}
            {isError && (
                <div
                    role="alert"
                    className="mt-7 flex flex-wrap items-center gap-4"
                >
                    <p className="text-sm text-red-700">
                        Unable to load your security settings.
                    </p>
                    <Button
                        variant="outline"
                        className="h-10 bg-white px-4"
                        onClick={() => void refetch()}
                    >
                        Try again
                    </Button>
                </div>
            )}

            {/* ENABLED: offer to disable */}
            {!isLoading && !isError && status?.enabled && stage === "idle" && (
                <div className="mt-8 flex flex-col gap-5 border-t border-[#e7e9e1] pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#e9ecdf] px-3 py-1.5 text-xs font-medium text-[#555e49]">
                            <Check className="size-3.5" aria-hidden="true" />{" "}
                            2FA is enabled
                        </span>
                        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                            Switching phones? Disable and set up again to
                            connect your new device.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        className="h-11 self-start bg-white px-5 sm:self-center"
                        onClick={() => {
                            disable.reset();
                            setConfirmDisable(true);
                        }}
                    >
                        Disable 2FA
                    </Button>
                </div>
            )}

            {/* DISABLED: offer to enable */}
            {!isLoading &&
                !isError &&
                status &&
                !status.enabled &&
                stage === "idle" && (
                    <div className="mt-8 flex flex-col gap-5 border-t border-[#e7e9e1] pt-6 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <span className="inline-flex items-center gap-2 rounded-full bg-[#f0f1eb] px-3 py-1.5 text-xs font-medium text-[#73776e]">
                                <span
                                    className="size-1.5 rounded-full bg-[#85897f]"
                                    aria-hidden="true"
                                />{" "}
                                Not enabled
                            </span>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                Set up with Google Authenticator, Authy, or a
                                similar app.
                            </p>
                        </div>
                        <Button
                            className="h-11 self-start px-5 hover:bg-[#444f3a] sm:self-center"
                            onClick={handleStartSetup}
                            disabled={setup.isPending}
                        >
                            {setup.isPending ? "Preparing…" : "Enable 2FA"}
                        </Button>
                    </div>
                )}
            {setup.isError && (
                <p role="alert" className="mt-4 text-sm text-red-700">
                    Unable to start setup. Please try again.
                </p>
            )}

            {/* SCANNING: show QR + verify code */}
            {stage === "scanning" && qrCode && (
                <div className="mt-8 space-y-5 border-t border-[#e7e9e1] pt-6">
                    <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                        Scan this QR code with your authenticator app, then
                        enter the 6-digit code it shows.
                    </p>
                    <img
                        src={qrCode}
                        alt="2FA QR code"
                        className="size-48 rounded-xl border border-[#dfe4d6] bg-white p-3"
                    />
                    <div className="space-y-2.5">
                        <Label
                            htmlFor="two-factor-code"
                            className="text-[10px] font-medium tracking-[0.18em] text-[#73776e] uppercase"
                        >
                            Authenticator code
                        </Label>
                        <div className="flex flex-wrap items-center gap-3">
                            <Input
                                id="two-factor-code"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                disabled={enable.isPending}
                                value={code}
                                onChange={(e) =>
                                    setCode(e.target.value.replace(/\D/g, ""))
                                }
                                placeholder="123456"
                                className="h-11 w-40 rounded-lg bg-[#fafbf7] px-3 font-mono tracking-[0.2em] shadow-none focus-visible:ring-[#7a8568]/20"
                            />
                            <Button
                                className="h-11 px-5 hover:bg-[#444f3a]"
                                onClick={handleVerify}
                                disabled={
                                    !/^\d{6}$/.test(code) || enable.isPending
                                }
                            >
                                {enable.isPending ? "Verifying…" : "Verify"}
                            </Button>
                            <Button
                                variant="ghost"
                                className="h-11 px-4"
                                onClick={resetFlow}
                                disabled={enable.isPending}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                    {enable.isError && (
                        <p role="alert" className="text-sm text-red-700">
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
                <DialogContent className="settings-theme border-[#dfe4d6] bg-white text-[#252823] sm:max-w-md [&_button]:min-h-10">
                    <DialogHeader>
                        <DialogTitle>Save your recovery codes</DialogTitle>
                        <DialogDescription>
                            Each code can be used once to log in if you lose
                            your device. They will not be shown again.
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm min-[400px]:grid-cols-2">
                        {recoveryCodes.map((rc) => (
                            <li key={rc} className="break-all">
                                {rc}
                            </li>
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
                <DialogContent className="settings-theme border-[#dfe4d6] bg-white text-[#252823] sm:max-w-md [&_button]:min-h-10">
                    <DialogHeader>
                        <DialogTitle>
                            Disable two-factor authentication?
                        </DialogTitle>
                        <DialogDescription>
                            Your authenticator setup and recovery codes will be
                            erased. You'll need to set up 2FA again from scratch
                            to turn it back on.
                        </DialogDescription>
                    </DialogHeader>
                    {disable.isError && (
                        <p role="alert" className="text-sm text-red-700">
                            Unable to disable 2FA. Please try again.
                        </p>
                    )}
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
