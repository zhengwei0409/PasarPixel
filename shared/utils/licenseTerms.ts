export const TERMS_VERSION = "pasarpixel-devnet-2026-10-17";
export type BlockchainTier = "PERSONAL" | "COMMERCIAL";

// Versioned terms for this project's Devnet prototype, based on the agreed
// Personal/Commercial rules. A production terms version needs separate review.
export function licenseTerms(tier: BlockchainTier) {
    return {
        version: TERMS_VERSION, licenseType: tier,
        title: `PasarPixel ${tier === "PERSONAL" ? "Personal" : "Commercial"} License — Devnet test terms`,
        clauses: [
            "These terms describe a test purchase on Solana Devnet using test SOL.",
            tier === "PERSONAL" ? "The asset may be used in personal, non-commercial projects. Commercial use is not included."
                : "The asset may be used in personal and commercial projects.",
            "The license is non-exclusive. The seller retains copyright and may license the same asset to other buyers.",
            "The original asset files may not be resold or redistributed as standalone assets.",
            "The license is issued to the purchasing account and wallet. The License NFT cannot be transferred or burned.",
            "The referenced content manifest identifies the file version covered by this purchase.",
            "The NFT records issuance. Current platform download access is checked separately and may be restricted by account or content moderation.",
        ],
    };
}
