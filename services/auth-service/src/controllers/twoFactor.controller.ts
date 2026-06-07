import { Response } from "express";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/requireAuth";

// Shown inside the authenticator app next to the 6-digit code, e.g. "PasarPixel (alice@x.com)".
const APP_NAME = "PasarPixel";

const RECOVERY_CODE_COUNT = 10;

// One readable one-time code, e.g. "a3f9-2k8d-91xz".
function generateRecoveryCode(): string {
    const raw = crypto.randomBytes(6).toString("hex"); // 12 hex chars
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

// Tells the UI whether to show "Enable 2FA" or "Disable 2FA".
export async function twoFactorStatus(req: AuthedRequest, res: Response) {
    const userId = req.userId!;
    const record = await prisma.twoFactorAuth.findUnique({ where: { userId } });
    res.json({ enabled: !!record?.isEnabled });
}

// Step 1 of enabling 2FA: generate a fresh secret, store it (not yet enabled),
// and return a QR code the user scans with their authenticator app.
export async function setupTwoFactor(req: AuthedRequest, res: Response) {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
    }

    const existing = await prisma.twoFactorAuth.findUnique({ where: { userId } });
    if (existing?.isEnabled) {
        res.status(400).json({ error: "2FA is already enabled" });
        return;
    }

    // The shared secret. The authenticator app and our server both use it
    // (together with the current time) to derive the same 6-digit code.
    const secret = generateSecret();

    // Save (or overwrite) the secret, but keep it disabled until the user
    // proves they scanned it correctly via /enable.
    await prisma.twoFactorAuth.upsert({
        where: { userId },
        update: { secret, isEnabled: false },
        create: { userId, secret, isEnabled: false },
    });

    // otpauth:// URL is the standard format authenticator apps understand.
    const otpauthUrl = generateURI({ issuer: APP_NAME, label: user.email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    res.json({ qrCode: qrCodeDataUrl });
}

// Step 2 of enabling 2FA: verify the code the user typed from their app.
// Only flip isEnabled to true if it matches — this confirms the scan worked.
export async function enableTwoFactor(req: AuthedRequest, res: Response) {
    const userId = req.userId!;
    const { code } = req.body;

    if (!code) {
        res.status(400).json({ error: "Verification code is required" });
        return;
    }

    const record = await prisma.twoFactorAuth.findUnique({ where: { userId } });
    if (!record) {
        res.status(400).json({ error: "Start 2FA setup first" });
        return;
    }
    if (record.isEnabled) {
        res.status(400).json({ error: "2FA is already enabled" });
        return;
    }

    // Allow a 30s clock skew so a code that just rolled over still works.
    const result = await verify({ token: code, secret: record.secret, epochTolerance: 30 });
    if (!result.valid) {
        res.status(400).json({ error: "Invalid verification code" });
        return;
    }

    // Generate the recovery codes. The plaintext is returned to the user ONCE
    // here; only bcrypt hashes are stored, so the server can never reveal them
    // again (same reasoning as user passwords).
    const plainCodes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
    const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));

    await prisma.$transaction([
        prisma.twoFactorAuth.update({
            where: { userId },
            data: { isEnabled: true },
        }),
        prisma.recoveryCode.createMany({
            data: hashedCodes.map((code) => ({ twoFactorAuthId: record.id, code })),
        }),
    ]);

    res.json({ message: "2FA enabled successfully", recoveryCodes: plainCodes });
}

// Turn 2FA off for the current user.
export async function disableTwoFactor(req: AuthedRequest, res: Response) {
    const userId = req.userId!;

    const record = await prisma.twoFactorAuth.findUnique({ where: { userId } });
    if (!record) {
        res.status(400).json({ error: "2FA is not set up" });
        return;
    }

    // Remove recovery codes first to satisfy the foreign key, then the record.
    await prisma.recoveryCode.deleteMany({ where: { twoFactorAuthId: record.id } });
    await prisma.twoFactorAuth.delete({ where: { userId } });

    res.json({ message: "2FA disabled successfully" });
}
