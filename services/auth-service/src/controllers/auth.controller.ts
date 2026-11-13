import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { verify as verifyTotp } from "otplib";
import type { Prisma, TwoFactorAuth } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { publishUserRegistered, publishPasswordReset } from "../lib/publisher";
import type { AuthedRequest } from "../middleware/requireAuth";
import type { AdminAccount } from "../../../../shared/types/adminAccount";

export async function listAdminAccounts(req: AuthedRequest, res: Response) {
    const admin = await prisma.userRole.findFirst({
        where: { userId: req.userId!, role: { name: "ADMIN" } },
        select: { userId: true },
    });
    if (!admin) {
        res.status(403).json({ error: "Forbidden: insufficient role" });
        return;
    }

    const accounts = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            email: true,
            createdAt: true,
            roles: { select: { role: { select: { name: true } } } },
            twoFactorAuth: { select: { isEnabled: true, lockedUntil: true } },
        },
    });
    const now = new Date();
    const result: AdminAccount[] = accounts.map(({ id, email, createdAt, roles, twoFactorAuth }) => ({
        userId: id,
        email,
        createdAt: createdAt.toISOString(),
        roles: roles.map(({ role }) => role.name).sort(),
        status: twoFactorAuth?.isEnabled && twoFactorAuth.lockedUntil && twoFactorAuth.lockedUntil > now
            ? "TWO_FACTOR_LOCKED"
            : "ACTIVE",
    }));
    res.set("Cache-Control", "no-store").json(result);
}

export async function passwordStatus(req: AuthedRequest, res: Response) {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
    }
    res.json({ hasPassword: Boolean(user.passwordHash) });
}

export async function changePassword(req: AuthedRequest, res: Response) {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== "string" || !currentPassword || typeof newPassword !== "string") {
        res.status(400).json({ error: "Current and new passwords are required" });
        return;
    }
    if (newPassword.length < 8 || Buffer.byteLength(newPassword, "utf8") > 72) {
        res.status(400).json({ error: "New password must be at least 8 characters and at most 72 bytes" });
        return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
    }
    if (!user.passwordHash) {
        res.status(400).json({ error: "This account uses Google login" });
        return;
    }
    if (!await bcrypt.compare(currentPassword, user.passwordHash)) {
        res.status(400).json({ error: "Current password is incorrect" });
        return;
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
        res.status(400).json({ error: "New password must be different from your current password" });
        return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const changed = await prisma.$transaction(async (tx) => {
        const result = await tx.user.updateMany({
            where: { id: user.id, passwordHash: user.passwordHash },
            data: { passwordHash },
        });
        if (result.count !== 1) return false;
        await tx.passwordReset.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: new Date() },
        });
        return true;
    });
    if (!changed) {
        res.status(409).json({ error: "Your password has changed. Please try again with your current password" });
        return;
    }
    res.json({ message: "Password changed successfully" });
}

async function getUserRoles(userId: number, db: Prisma.TransactionClient = prisma): Promise<string[]> {
    const userRoles = await db.userRole.findMany({
        where: { userId },
        include: { role: true },
    });
    return userRoles.map((ur) => ur.role.name);
}

function generateTokens(userId: number, email: string, roles: string[], rememberMe = false) {
    const accessToken = jwt.sign(
        { sub: userId, email, roles },
        process.env.JWT_SECRET!,
        { expiresIn: "15m" }
    );

    const refreshToken = crypto.randomBytes(64).toString("hex");
    const refreshTokenDays = rememberMe ? 30 : 7;
    const expiresAt = new Date(Date.now() + refreshTokenDays * 24 * 60 * 60 * 1000);

    return { accessToken, refreshToken, expiresAt };
}

// A short-lived token issued after the password check but before 2FA.
// purpose: "2fa" marks it as NOT a normal login token — it can only be
// exchanged at /auth/2fa/verify-login, never used to access real endpoints.
function generateTempToken(userId: number, rememberMe = false) {
    return jwt.sign(
        { sub: userId, purpose: "2fa", rememberMe },
        process.env.JWT_SECRET!,
        { expiresIn: "5m" }
    );
}

// Issues the real login tokens and persists the refresh token. Shared by the
// plain login path and the 2FA verify path so they stay consistent.
async function issueLoginTokens(
    userId: number, email: string, rememberMe = false, db: Prisma.TransactionClient = prisma,
) {
    const roles = await getUserRoles(userId, db);
    const { accessToken, refreshToken, expiresAt } = generateTokens(userId, email, roles, rememberMe);

    await db.refreshToken.create({
        data: { userId, token: refreshToken, expiresAt },
    });

    return { accessToken, refreshToken };
}

export async function register(req: Request, res: Response) {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        res.status(400).json({ error: "Email already in use" });
        return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: { email, passwordHash },
    });

    const buyerRole = await prisma.role.findUnique({ where: { name: "BUYER" } });
    await prisma.userRole.create({
        data: { userId: user.id, roleId: buyerRole!.id },
    });

    const roles = await getUserRoles(user.id);

    const { accessToken, refreshToken, expiresAt } = generateTokens(user.id, user.email, roles);

    await prisma.refreshToken.create({
        data: { userId: user.id, token: refreshToken, expiresAt },
    });

    await publishUserRegistered({ userId: user.id, name: user.email, email: user.email });

    res.status(201).json({ accessToken, refreshToken });
}

export async function login(req: Request, res: Response) {
    const { email, password, rememberMe = false } = req.body;

    if (typeof rememberMe !== "boolean") {
        res.status(400).json({ error: "Remember me must be a boolean" });
        return;
    }

    if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
    }

    if (!user.passwordHash) {
        res.status(401).json({ error: "This account uses Google login" });
        return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
    }

    // Password is correct. If this account has 2FA enabled, don't log them in
    // yet — hand back a temp token and make them complete the second step.
    const twoFactor = await prisma.twoFactorAuth.findUnique({ where: { userId: user.id } });
    if (twoFactor?.isEnabled) {
        res.json({
            twoFactorRequired: true,
            tempToken: generateTempToken(user.id, rememberMe),
            ...getTwoFactorLoginState(twoFactor),
        });
        return;
    }

    const tokens = await issueLoginTokens(user.id, user.email, rememberMe);
    res.json(tokens);
}

const MAX_TWO_FACTOR_ATTEMPTS = 5;
const TWO_FACTOR_LOCKOUT_MS = 15 * 60 * 1000;

function getTwoFactorLoginState(
    { failedAttempts, lockedUntil }: Pick<TwoFactorAuth, "failedAttempts" | "lockedUntil">,
    now = new Date(),
) {
    if (lockedUntil && lockedUntil > now) return { attemptsRemaining: 0, lockedUntil };
    return {
        attemptsRemaining: MAX_TWO_FACTOR_ATTEMPTS - (lockedUntil ? 0 : failedAttempts),
        lockedUntil: null,
    };
}

function sendTwoFactorLockout(res: Response, lockedUntil: Date) {
    res.set("Retry-After", String(Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000))));
    res.status(429).json({
        error: "Too many incorrect codes. Two-factor sign-in is temporarily locked.",
        attemptsRemaining: 0,
        lockedUntil,
    });
}

async function findMatchingRecoveryCode(twoFactorAuthId: number, code: string) {
    const unusedCodes = await prisma.recoveryCode.findMany({ where: { twoFactorAuthId, isUsed: false } });
    for (const recoveryCode of unusedCodes) {
        if (await bcrypt.compare(code, recoveryCode.code)) return recoveryCode.id;
    }
    return null;
}

export async function verifyLogin(req: Request, res: Response) {
    const { tempToken, code } = req.body ?? {};

    if (typeof tempToken !== "string" || !tempToken || typeof code !== "string" || !code) {
        res.status(400).json({ error: "Temp token and code are required" });
        return;
    }

    // The temp token must be valid, unexpired, and carry our 2fa marker —
    // a normal access token must not be accepted here.
    let userId: number;
    let rememberMe = false;
    try {
        const payload = jwt.verify(tempToken, process.env.JWT_SECRET!) as unknown as {
            sub: number;
            purpose?: string;
            rememberMe?: boolean;
        };
        if (payload.purpose !== "2fa" || !Number.isSafeInteger(payload.sub) || payload.sub <= 0) {
            res.status(401).json({ error: "Invalid token" });
            return;
        }
        userId = payload.sub;
        rememberMe = payload.rememberMe === true;
    } catch {
        res.status(401).json({
            error: "Your sign-in session has expired. Please sign in again.",
            code: "TWO_FACTOR_CHALLENGE_EXPIRED",
        });
        return;
    }

    const twoFactor = await prisma.twoFactorAuth.findUnique({ where: { userId } });
    if (!twoFactor?.isEnabled) {
        res.status(400).json({ error: "2FA is not enabled for this account" });
        return;
    }

    const initialState = getTwoFactorLoginState(twoFactor);
    if (initialState.lockedUntil) {
        sendTwoFactorLockout(res, initialState.lockedUntil);
        return;
    }

    // Check the code before taking the row lock so bcrypt doesn't hold up other requests.
    const validTotp = /^\d{6}$/.test(code)
        && (await verifyTotp({ token: code, secret: twoFactor.secret, epochTolerance: 30 })).valid;
    const recoveryCodeId = /^[0-9a-f]{4}(?:-[0-9a-f]{4}){2}$/.test(code)
        ? await findMatchingRecoveryCode(twoFactor.id, code)
        : null;

    const result = await prisma.$transaction(async (tx) => {
        // Serialize decisions for the same 2FA record, including parallel requests with new tokens.
        const [current] = await tx.$queryRaw<Pick<TwoFactorAuth, "id" | "isEnabled" | "secret" | "failedAttempts" | "lockedUntil">[]>`
            SELECT "id", "isEnabled", "secret", "failedAttempts", "lockedUntil"
            FROM "two_factor_auth" WHERE "id" = ${twoFactor.id} FOR NO KEY UPDATE
        `;
        if (!current?.isEnabled || current.secret !== twoFactor.secret) {
            return { status: "unavailable" } as const;
        }
        const now = new Date();
        const state = getTwoFactorLoginState(current, now);
        if (state.lockedUntil) return { status: "locked", lockedUntil: state.lockedUntil } as const;

        let accepted = validTotp;
        if (recoveryCodeId !== null) {
            const consumed = await tx.recoveryCode.updateMany({
                where: { id: recoveryCodeId, twoFactorAuthId: current.id, isUsed: false },
                data: { isUsed: true },
            });
            accepted = consumed.count === 1;
        }

        if (!accepted) {
            const attemptsRemaining = state.attemptsRemaining - 1;
            const lockedUntil = attemptsRemaining === 0 ? new Date(now.getTime() + TWO_FACTOR_LOCKOUT_MS) : null;
            await tx.twoFactorAuth.update({
                where: { id: current.id },
                data: { failedAttempts: MAX_TWO_FACTOR_ATTEMPTS - attemptsRemaining, lockedUntil },
            });
            if (lockedUntil) return { status: "locked", lockedUntil } as const;
            return { status: "invalid", attemptsRemaining } as const;
        }

        // The locked 2FA record references an existing user.
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
        if (current.failedAttempts || current.lockedUntil) {
            await tx.twoFactorAuth.update({
                where: { id: current.id },
                data: { failedAttempts: 0, lockedUntil: null },
            });
        }
        const tokens = await issueLoginTokens(userId, user.email, rememberMe, tx);
        return { status: "accepted", tokens } as const;
    });

    switch (result.status) {
        case "locked":
            sendTwoFactorLockout(res, result.lockedUntil);
            return;
        case "invalid":
            res.status(401).json({ error: "Invalid verification code", attemptsRemaining: result.attemptsRemaining });
            return;
        case "unavailable":
            res.status(400).json({ error: "2FA is no longer available for this sign-in. Please sign in again." });
            return;
        case "accepted":
            res.json(result.tokens);
    }
}

export async function refreshToken(req: Request, res: Response) {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        res.status(400).json({ error: "Refresh token is required" });
        return;
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
        res.status(401).json({ error: "Invalid or expired refresh token" });
        return;
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
    }

    const roles = await getUserRoles(user.id);
    const accessToken = jwt.sign(
        { sub: user.id, email: user.email, roles },
        process.env.JWT_SECRET!,
        { expiresIn: "15m" }
    );

    res.json({ accessToken });
}

export async function logout(req: Request, res: Response) {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        res.status(400).json({ error: "Refresh token is required" });
        return;
    }

    await prisma.refreshToken.updateMany({
        where: { token: refreshToken, revokedAt: null },
        data: { revokedAt: new Date() },
    });

    res.json({ message: "Logged out successfully" });
}

export async function forgotPassword(req: Request, res: Response) {
    const { email } = req.body;

    if (!email) {
        res.status(400).json({ error: "Email is required" });
        return;
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user || !user.passwordHash) {
        res.json({ message: "If that email exists, a reset link has been sent" });
        return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordReset.create({
        data: { userId: user.id, token, expiresAt },
    });

    await publishPasswordReset({
        userId: user.id,
        email: user.email,
        resetToken: token,
    });

    res.json({ message: "If that email exists, a reset link has been sent" });
}

export async function resetPassword(req: Request, res: Response) {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        res.status(400).json({ error: "Token and new password are required" });
        return;
    }

    const record = await prisma.passwordReset.findUnique({ where: { token } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
        res.status(400).json({ error: "Invalid or expired reset token" });
        return;
    }

    const user = await prisma.user.findUnique({ where: { id: record.userId } });
    if (!user) {
        res.status(400).json({ error: "User not found" });
        return;
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash!);
    if (isSamePassword) {
        res.status(400).json({ error: "New password must be different from your current password" });
        return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
    });

    await prisma.passwordReset.update({
        where: { token },
        data: { usedAt: new Date() },
    });

    res.json({ message: "Password reset successfully" });
}

export async function googleCallback(req: Request, res: Response) {
    const user = req.user as any;

    const buyerRole = await prisma.role.findUnique({ where: { name: "BUYER" } });

    const existingRole = await prisma.userRole.findUnique({
        where: { userId_roleId: { userId: user.id, roleId: buyerRole!.id } },
    });
    const isNewUser = !existingRole;

    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: buyerRole!.id } },
        update: {},
        create: { userId: user.id, roleId: buyerRole!.id },
    });

    if (isNewUser) {
        await publishUserRegistered({ userId: user.id, name: user.displayName ?? user.email, email: user.email });
    }

    // Same 2FA gate as password login, but the signal is carried in the redirect
    // URL instead of a JSON body. A brand-new user can't have 2FA enabled yet,
    // so they always fall through to the normal token path.
    const twoFactor = await prisma.twoFactorAuth.findUnique({ where: { userId: user.id } });
    if (twoFactor?.isEnabled) {
        const { attemptsRemaining, lockedUntil } = getTwoFactorLoginState(twoFactor);
        const params = new URLSearchParams({
            twoFactorRequired: "true",
            tempToken: generateTempToken(user.id),
            attemptsRemaining: String(attemptsRemaining),
        });
        if (lockedUntil) params.set("lockedUntil", lockedUntil.toISOString());
        res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/auth/callback?${params}`);
        return;
    }

    const { accessToken, refreshToken } = await issueLoginTokens(user.id, user.email);
    res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`);
}

export async function me(req: Request, res: Response) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing or invalid Authorization header" });
        return;
    }

    const token = authHeader.split(" ")[1];

    let userId: number;
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as unknown as {
            sub: number;
            purpose?: unknown;
        };
        if (payload.purpose !== undefined || !Number.isSafeInteger(payload.sub) || payload.sub <= 0) {
            res.status(401).json({ error: "Invalid access token" });
            return;
        }
        userId = payload.sub;
    } catch {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { roles: { include: { role: true } } },
        });
        if (!user) {
            res.status(401).json({ error: "User not found" });
            return;
        }
        res.json({ userId: user.id, email: user.email, roles: user.roles.map(({ role }) => role.name) });
    } catch {
        res.status(503).json({ error: "Unable to verify your session. Please try again." });
    }
}
