// Preset reasons admins can pick instead of typing them manually.
// The chosen text is sent to the backend as a plain string (adminNote / reason),
// so editing these lists never requires a backend change.

export const APPLICATION_REJECT_REASONS = [
    "ID document is unclear or unreadable",
    "ID document does not match the legal name provided",
    "Incomplete or inaccurate application details",
    "Portfolio link is broken or does not show original work",
    "Applicant does not meet the minimum age requirement",
];

export const ASSET_REJECT_REASONS = [
    "Copyright or trademark infringement",
    "Preview does not match the actual asset",
    "Low quality or corrupted files",
    "Inappropriate or prohibited content",
    "Misleading title, description, or tags",
    "Duplicate of an existing listing",
];

export const SELLER_REVOKE_REASONS = [
    "Repeated copyright infringement",
    "Selling prohibited or inappropriate content",
    "Fraudulent activity or payment abuse",
    "Repeated violations after prior warnings",
    "Impersonation or misrepresentation of identity",
];

export const USER_DELETE_REASONS = [
    "Repeated marketplace rule violations",
    "Fraud or payment abuse",
    "Spam or scam activity",
    "Impersonation",
    "User requested account deletion",
];

export const USER_SUSPEND_REASONS = [
    "Marketplace rule violations",
    "Suspected fraud or payment abuse",
    "Spam or scam activity",
    "Impersonation",
    "Suspected account compromise",
];
