import { timingSafeEqual } from "node:crypto";

export function validInternalToken(provided: unknown, expected = process.env.INTERNAL_SERVICE_TOKEN): boolean {
    if (!expected || expected.length < 32 || typeof provided !== "string") return false;
    const actual = Buffer.from(provided);
    const wanted = Buffer.from(expected);
    return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
