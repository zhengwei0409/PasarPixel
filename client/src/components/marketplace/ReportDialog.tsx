import { useState } from "react";
import { Info, CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

export default function ReportDialog({
  assetId,
  open,
  onOpenChange,
}: ReportDialogProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const createReport = useCreateReport();
  const duplicate =
    (createReport.error as { response?: { status?: number } } | null)?.response
      ?.status === 409;
  const changeOpen = (next: boolean) => {
    if (!next && createReport.isPending) return;
    onOpenChange(next);
  };
  const reset = () => {
    setReason("");
    setDescription("");
    setSubmitted(false);
    createReport.reset();
  };
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        className="asset-detail-theme max-h-[90dvh] overflow-y-auto rounded-2xl p-6 shadow-2xl duration-300 motion-reduce:animate-none motion-reduce:transition-none sm:max-w-[400px]"
        onCloseAutoFocus={reset}
      >
        {submitted || duplicate ? (
          <>
            <CheckCircle2 className="mt-2 text-primary" size={30} />
            <DialogHeader>
              <DialogTitle>
                {duplicate ? "Already reported" : "Report submitted"}
              </DialogTitle>
              <DialogDescription>
                {duplicate
                  ? "You have already reported this asset. You can only submit one report per asset."
                  : "Thanks for letting us know. Our moderation team will review your report."}
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => changeOpen(false)}>Close</Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Report Asset
              </DialogTitle>
              <DialogDescription className="sr-only">
                Select a reason and provide details for the moderation team.
              </DialogDescription>
            </DialogHeader>
            <form
              className="mt-2 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (
                  !reason ||
                  (reason === "Other" && !description.trim()) ||
                  createReport.isPending
                )
                  return;
                const details = description.trim();
                createReport.mutate(
                  {
                    assetId,
                    reason: details ? `${reason}\n\n${details}` : reason,
                  },
                  { onSuccess: () => setSubmitted(true) },
                );
              }}
            >
              <div className="space-y-2">
                <label htmlFor="report-reason" className="text-xs font-medium">
                  Reason
                </label>
                <div className="relative">
                  <select
                    id="report-reason"
                    required
                    value={reason}
                    disabled={createReport.isPending}
                    onChange={(event) => setReason(event.target.value)}
                    className="h-10 w-full appearance-none rounded-md border bg-muted/50 pl-3 pr-10 text-sm"
                  >
                    <option value="" disabled>
                      Select a reason
                    </option>
                    {ASSET_REPORT_REASONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="report-description"
                    className="text-xs font-medium"
                  >
                    Description
                  </label>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    {reason === "Other" ? "Required for ‘Other’" : "Optional"}
                  </span>
                </div>
                <textarea
                  id="report-description"
                  rows={4}
                  required={reason === "Other"}
                  maxLength={2000}
                  disabled={createReport.isPending}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Please provide additional details about the issue…"
                  className="w-full resize-none rounded-md border bg-muted/50 p-3 text-sm placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex gap-2 rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                <Info size={15} className="mt-0.5 shrink-0" />
                <p>
                  You can only report the same asset once. Our moderation team
                  will review your report.
                </p>
              </div>
              {createReport.isError && (
                <p role="alert" className="text-xs text-destructive">
                  Could not submit your report. Please try again.
                </p>
              )}
              <div className="space-y-2">
                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={
                    !reason ||
                    (reason === "Other" && !description.trim()) ||
                    createReport.isPending
                  }
                >
                  {createReport.isPending ? "Submitting…" : "Submit Report"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={createReport.isPending}
                  onClick={() => changeOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
