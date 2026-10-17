// Integer conversion shared by upload validation and backend pricing.
export function parseSolLamports(value: unknown): bigint | null {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" && typeof value !== "number") throw new Error("Enter a positive SOL price with up to 9 decimal places");
    const text = String(value).trim();
    if (!/^(0|[1-9]\d{0,10})(\.\d{1,9})?$/.test(text)) throw new Error("Enter a positive SOL price with up to 9 decimal places");
    const [whole, fraction = ""] = text.split(".");
    const lamports = BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, "0"));
    if (lamports <= 0n || lamports > 18_446_744_073_709_551_615n) throw new Error("SOL price is outside the supported range");
    return lamports;
}
