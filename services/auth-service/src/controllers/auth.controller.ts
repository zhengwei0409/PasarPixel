import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma";

function generateTokens(userId: number, email: string) {
    const accessToken = jwt.sign(
        { sub: userId, email },
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

    const { accessToken, refreshToken, expiresAt } = generateTokens(user.id, user.email);

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

    const { accessToken, refreshToken, expiresAt } = generateTokens(user.id, user.email);

    await prisma.refreshToken.create({
        data: { userId: user.id, token: refreshToken, expiresAt },
    });

    res.json({ accessToken, refreshToken });
}
