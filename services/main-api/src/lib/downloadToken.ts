import { createHmac, timingSafeEqual } from "crypto";

// Secret used to sign download tokens. Set DOWNLOAD_TOKEN_SECRET in .env.
const SECRET = process.env.DOWNLOAD_TOKEN_SECRET!;

// 15-minute expiry (FR-3.4), overridable via env (seconds).
const EXPIRES_IN_SECONDS = Number(
  process.env.DOWNLOAD_TOKEN_EXPIRES_IN ?? 900
);

interface DownloadTokenPayload {
  orderId: number;
  userId: number;
  exp: number; // unix epoch seconds
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payloadB64: string): string {
  return base64url(createHmac("sha256", SECRET).update(payloadB64).digest());
}

export function signDownloadToken(params: {
  orderId: number;
  userId: number;
}): string {
  const payload: DownloadTokenPayload = {
    orderId: params.orderId,
    userId: params.userId,
    exp: Math.floor(Date.now() / 1000) + EXPIRES_IN_SECONDS,
  };
  const payloadB64 = base64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyDownloadToken(
  token: string
): DownloadTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts;

  // Recompute signature and compare in constant time to avoid timing attacks.
  const expectedSig = sign(payloadB64);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  let payload: DownloadTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, "base64").toString("utf8")
    );
  } catch {
    return null;
  }

  if (Math.floor(Date.now() / 1000) > payload.exp) return null;

  return payload;
}

export { EXPIRES_IN_SECONDS as DOWNLOAD_TOKEN_EXPIRES_IN_SECONDS };
