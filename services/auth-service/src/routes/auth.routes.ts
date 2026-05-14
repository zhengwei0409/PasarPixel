import { Router } from "express";
import passport from "../config/passport";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { register, login, refreshToken, logout } from "../controllers/auth.controller";

// Router is a mini Express app — define routes here, then attach to main app in index.ts
const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);
router.post("/logout", logout);

// Route 1: Redirect user to Google's login page
// scope tells Google what info we want access to: profile (name, photo) and email
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"]}));

// Route 2: Google redirects user back here after login with an authorization code
// passport.authenticate exchanges the code for an access token, then fetches user info from Google
// session: false — we use JWT instead of server-side sessions
// If authentication fails, redirect to /login; if successful, run the next handler
router.get("/google/callback", passport.authenticate("google", { failureRedirect: "/login", session: false }), async (req, res) => {

    const user = req.user as any;

    const accessToken = jwt.sign(
        { sub: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: "15m" }
    );

    const refreshToken = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
        data: { userId: user.id, token: refreshToken, expiresAt },
    });

    res.redirect(`http://localhost:5173/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`);
})

export default router;
