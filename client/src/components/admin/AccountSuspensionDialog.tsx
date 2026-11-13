import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ACCOUNT_MODERATION_REASON_LIMIT, type AdminAccount } from "../../../../shared/types/adminAccount";
import { useUpdateAccountSuspension } from "../../hooks/useUsers";
import { USER_SUSPEND_REASONS } from "../../lib/adminReasons";
import { getErrorMessage } from "../../lib/errors";
import ReasonPicker from "../ReasonPicker";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

export type SuspensionTarget = Pick<AdminAccount, "userId" | "email" | "status" | "roles"> & { name: string };

export function AccountSuspensionDialog({ target, currentUserId, onClose, onSuccess, restoreFocus }: {
    target: SuspensionTarget | null;
    currentUserId: number | null;
    onClose: () => void;
    onSuccess: (message: string) => void;
    restoreFocus?: () => void;
}) {
    const [reason, setReason] = useState("");
    const mutation = useUpdateAccountSuspension();
    const suspended = target?.status !== "SUSPENDED";
    const action = suspended ? "Suspend" : "Unsuspend";
    const canSubmit = target && currentUserId !== null && target.userId !== currentUserId && !target.roles.includes("ADMIN") && reason.trim();

    function close() {
        setReason("");
        mutation.reset();
        onClose();
    }

    return (
        <Dialog open={target !== null} onOpenChange={(open) => { if (!open && !mutation.isPending) close(); }}>
            <DialogContent
                className="admin-dashboard-theme max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
                showCloseButton={!mutation.isPending}
                onCloseAutoFocus={restoreFocus ? (event) => { event.preventDefault(); restoreFocus(); } : undefined}
                onEscapeKeyDown={(event) => { if (mutation.isPending) event.preventDefault(); }}
                onInteractOutside={(event) => { if (mutation.isPending) event.preventDefault(); }}
            >
                <DialogHeader>
                    <DialogTitle>{action} account?</DialogTitle>
                    <DialogDescription>
                        {suspended
                            ? "This blocks account access and ends existing sessions. The user's records are kept."
                            : "This restores account access. The user will need to sign in again."}
                    </DialogDescription>
                </DialogHeader>
                {target && (
                    <form className="min-w-0 space-y-4" onSubmit={(event) => {
                        event.preventDefault();
                        if (!canSubmit || mutation.isPending) return;
                        mutation.mutate({ userId: target.userId, suspended, reason: reason.trim() }, {
                            onSuccess: () => {
                                onSuccess(`${target.name}: account ${suspended ? "suspended" : "unsuspended"}.`);
                                close();
                            },
                        });
                    }}>
                        <div className="break-words rounded-lg bg-secondary/60 p-3 text-sm">
                            <p className="font-semibold">{target.name}</p>
                            <p className="text-muted-foreground">{target.email}</p>
                        </div>
                        <fieldset disabled={mutation.isPending} className="min-w-0 space-y-2">
                            <Label htmlFor="account-suspension-reason">Reason</Label>
                            {suspended ? (
                                <div className="[&_[data-slot=select-trigger]]:h-auto [&_[data-slot=select-trigger]]:min-h-11 [&_[data-slot=select-trigger]]:whitespace-normal [&_[data-slot=select-trigger]]:text-left [&_[data-slot=select-value]]:line-clamp-none">
                                    <ReasonPicker
                                        id="account-suspension-reason"
                                        aria-describedby="account-suspension-reason-help"
                                        presets={USER_SUSPEND_REASONS}
                                        onChange={setReason}
                                        placeholder="Choose a reason"
                                        maxLength={ACCOUNT_MODERATION_REASON_LIMIT}
                                        contentClassName="admin-dashboard-theme max-w-[calc(100vw-4rem)] [&_[data-slot=select-item]]:min-h-10"
                                    />
                                </div>
                            ) : (
                                <Textarea
                                    id="account-suspension-reason"
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                    maxLength={ACCOUNT_MODERATION_REASON_LIMIT}
                                    aria-describedby="account-suspension-reason-help"
                                    required
                                />
                            )}
                            <p id="account-suspension-reason-help" className="text-xs text-muted-foreground">
                                The user will see this reason in their notifications.
                            </p>
                        </fieldset>
                        {mutation.error && <p role="alert" className="text-sm text-red-700">{getErrorMessage(mutation.error, "Unable to update the account. Please try again.")}</p>}
                        <DialogFooter className="m-0 gap-3 rounded-none border-0 bg-transparent p-0">
                            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={close}>Cancel</Button>
                            <Button type="submit" variant={suspended ? "destructive" : "default"} disabled={!canSubmit || mutation.isPending}>
                                {mutation.isPending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                                {action} account
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
