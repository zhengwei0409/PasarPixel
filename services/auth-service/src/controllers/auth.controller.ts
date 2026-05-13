import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

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

    const token = jwt.sign(
        { sub: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" }
    );

    res.status(201).json({ token });
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

    const token = jwt.sign(
        { sub: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" }
    );

    res.json({ token });
}
