import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useCreateReport } from "@/hooks/useReport";

interface ReportDialogProps {
    assetId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Lets a signed-in user report a listing with a free-text reason. On success it
// shows a thank-you state instead of closing immediately, so the user gets
// confirmation their report went through.
export default function ReportDialog({ assetId, open, onOpenChange }: ReportDialogProps) {
    const [reason, setReason] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const createReport = useCreateReport();

    const reset = () => {
        setReason("");
        setSubmitted(false);
        createReport.reset();
    };

    const handleSubmit = () => {
        createReport.mutate(
            { assetId, reason: reason.trim() },
            { onSuccess: () => setSubmitted(true) },
        );
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) reset();
                onOpenChange(next);
            }}
        >
            <DialogContent>
                {submitted ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Report submitted</DialogTitle>
                            <DialogDescription>
                                Thanks for letting us know. Our team will review this listing.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button onClick={() => onOpenChange(false)}>Close</Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Report this listing</DialogTitle>
                            <DialogDescription>
                                Tell us what's wrong with this listing. An admin will review it.
                            </DialogDescription>
                        </DialogHeader>
                        <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Reason for reporting…"
                            rows={4}
                        />
                        {createReport.isError && (
                            <p className="text-sm text-destructive">
                                Could not submit your report. Please try again.
                            </p>
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={reason.trim().length === 0 || createReport.isPending}
                            >
                                {createReport.isPending ? "Submitting…" : "Submit report"}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
