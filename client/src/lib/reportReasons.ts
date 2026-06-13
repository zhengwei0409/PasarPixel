// Preset reasons a buyer can pick when reporting a listing.
// The chosen text is sent to the backend as a plain string (Report.reason), so
// editing this list never requires a backend change.

export const ASSET_REPORT_REASONS = [
    "Copyright or trademark infringement",
    "Inappropriate or prohibited content",
    "Misleading title, description, or preview",
    "Spam or scam listing",
    "Stolen or duplicated work",
];

// Preset reasons an admin can pick when taking down a reported listing. Shown to
// the seller in their takedown notification.
export const ASSET_TAKEDOWN_REASONS = [
    "Confirmed copyright or trademark infringement",
    "Inappropriate or prohibited content",
    "Misleading title, description, or preview",
    "Spam or scam listing",
    "Stolen or duplicated work",
    "Violates PasarPixel's marketplace policies",
];
