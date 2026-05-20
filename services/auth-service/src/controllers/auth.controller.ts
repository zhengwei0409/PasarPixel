import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Resend } from "resend";
import { prisma } from "../lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

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

    const roles = await getUserRoles(user.id);

    const { accessToken, refreshToken, expiresAt } = generateTokens(user.id, user.email, roles);

    await prisma.refreshToken.create({
        data: { userId: user.id, token: refreshToken, expiresAt },
    });

    res.json({ accessToken, refreshToken });
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

    const accessToken = jwt.sign(
        { sub: user.id, email: user.email },
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

    const resetUrl = `http://localhost:5173/reset-password?token=${token}`;

    const { data, error } = await resend.emails.send({
        from: "PasarPixel <onboarding@resend.dev>",
        to: email,
        subject: "Reset your password",
        html: `
            <p>You requested a password reset.</p>
            <p><a href="${resetUrl}">Click here to reset your password</a></p>
            <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
        `,
    });

    if (error) {
        console.error("Resend error:", error);
    } else {
        console.log("Email sent:", data);
    }

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
    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: buyerRole!.id } },
        update: {},
        create: { userId: user.id, roleId: buyerRole!.id },
    });

    const roles = await getUserRoles(user.id);
    const { accessToken, refreshToken, expiresAt } = generateTokens(user.id, user.email, roles);

    await prisma.refreshToken.create({
        data: { userId: user.id, token: refreshToken, expiresAt },
    });

    res.redirect(`http://localhost:5173/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`);
}
