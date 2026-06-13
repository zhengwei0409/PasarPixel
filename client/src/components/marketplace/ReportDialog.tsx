import { useState } from "react";
import { Button } from "@/components/ui/button";
import ReasonPicker from "@/components/ReasonPicker";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useCreateReport } from "@/hooks/useReport";
import { ASSET_REPORT_REASONS } from "@/lib/reportReasons";

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
    // Bumped on reset so ReasonPicker remounts and clears its own internal state.
    const [formKey, setFormKey] = useState(0);
    const createReport = useCreateReport();

    const reset = () => {
        setReason("");
        setSubmitted(false);
        setFormKey((k) => k + 1);
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
                        <ReasonPicker
                            key={formKey}
                            presets={ASSET_REPORT_REASONS}
                            onChange={setReason}
                            placeholder="Select a reason for reporting"
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
