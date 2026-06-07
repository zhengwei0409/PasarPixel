import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { verify as verifyTotp } from "otplib";
import { prisma } from "../lib/prisma";
import { publishUserRegistered, publishPasswordReset } from "../lib/publisher";

async function getUserRoles(userId: number): Promise<string[]> {
    const userRoles = await prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
    });
    return userRoles.map((ur) => ur.role.name);
}

function generateTokens(userId: number, email: string, roles: string[]) {
    const accessToken = jwt.sign(
        { sub: userId, email, roles },
        process.env.JWT_SECRET!,
        { expiresIn: "15m" }
    );

    const refreshToken = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return { accessToken, refreshToken, expiresAt };
}

// A short-lived token issued after the password check but before 2FA.
// purpose: "2fa" marks it as NOT a normal login token — it can only be
// exchanged at /auth/2fa/verify-login, never used to access real endpoints.
function generateTempToken(userId: number) {
    return jwt.sign(
        { sub: userId, purpose: "2fa" },
        process.env.JWT_SECRET!,
        { expiresIn: "5m" }
    );
}

// Issues the real login tokens and persists the refresh token. Shared by the
// plain login path and the 2FA verify path so they stay consistent.
async function issueLoginTokens(userId: number, email: string) {
    const roles = await getUserRoles(userId);
    const { accessToken, refreshToken, expiresAt } = generateTokens(userId, email, roles);

    await prisma.refreshToken.create({
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
    const { email, password } = req.body;

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
        res.json({ twoFactorRequired: true, tempToken: generateTempToken(user.id) });
        return;
    }

    const tokens = await issueLoginTokens(user.id, user.email);
    res.json(tokens);
}

// Second step of login for 2FA-enabled accounts. Exchanges a valid temp token
// plus a correct authenticator code for the real login tokens.
export async function verifyLogin(req: Request, res: Response) {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
        res.status(400).json({ error: "Temp token and code are required" });
        return;
    }

    // The temp token must be valid, unexpired, and carry our 2fa marker —
    // a normal access token must not be accepted here.
    let userId: number;
    try {
        const payload = jwt.verify(tempToken, process.env.JWT_SECRET!) as unknown as {
            sub: number;
            purpose?: string;
        };
        if (payload.purpose !== "2fa") {
            res.status(401).json({ error: "Invalid token" });
            return;
        }
        userId = payload.sub;
    } catch {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }

    const twoFactor = await prisma.twoFactorAuth.findUnique({ where: { userId } });
    if (!twoFactor?.isEnabled) {
        res.status(400).json({ error: "2FA is not enabled for this account" });
        return;
    }

    const result = await verifyTotp({ token: code, secret: twoFactor.secret, epochTolerance: 30 });
    if (!result.valid) {
        res.status(401).json({ error: "Invalid verification code" });
        return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
    }

    const tokens = await issueLoginTokens(user.id, user.email);
    res.json(tokens);
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
        const tempToken = generateTempToken(user.id);
        res.redirect(`http://localhost:5173/auth/callback?twoFactorRequired=true&tempToken=${tempToken}`);
        return;
    }

    const { accessToken, refreshToken } = await issueLoginTokens(user.id, user.email);
    res.redirect(`http://localhost:5173/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`);
}

export async function me(req: Request, res: Response) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing or invalid Authorization header" });
        return;
    }

    const token = authHeader.split(" ")[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as unknown as {
            sub: number;
            email: string;
            roles: string[];
        };

        res.json({ userId: payload.sub, email: payload.email, roles: payload.roles });
    } catch {
        res.status(401).json({ error: "Invalid or expired token" });
    }
}
