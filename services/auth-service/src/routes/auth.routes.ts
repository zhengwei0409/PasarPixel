import { Router } from "express";
import passport from "../config/passport";
import { register, login, verifyLogin, refreshToken, logout, googleCallback, forgotPassword, resetPassword, me, passwordStatus, changePassword } from "../controllers/auth.controller";
import { twoFactorStatus, setupTwoFactor, enableTwoFactor, disableTwoFactor } from "../controllers/twoFactor.controller";
import { requireAuth } from "../middleware/requireAuth";
import { validInternalToken } from "../../../../shared/utils/internalAuth";
import { prisma } from "../lib/prisma";

// Router is a mini Express app — define routes here, then attach to main app in index.ts
const router = Router();
router.get("/internal/accounts/:id", async (req, res) => {
    if (!validInternalToken(req.headers["x-internal-token"])) { res.status(401).end(); return; }
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) { res.status(400).end(); return; }
    const user = await prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
    res.set("Cache-Control", "no-store").json({ exists: Boolean(user), roles: user?.roles.map(({ role }) => role.name) ?? [] });
});

router.post("/register", register);
router.post("/login", login);
router.post("/2fa/verify-login", verifyLogin);
router.post("/refresh", refreshToken);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", me);
router.get("/password/status", requireAuth, passwordStatus);
router.post("/change-password", requireAuth, changePassword);

// 2FA management — all require a logged-in user (valid access token)
router.get("/2fa/status", requireAuth, twoFactorStatus);
router.post("/2fa/setup", requireAuth, setupTwoFactor);
router.post("/2fa/enable", requireAuth, enableTwoFactor);
router.post("/2fa/disable", requireAuth, disableTwoFactor);

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"]}));

router.get("/google/callback", passport.authenticate("google", { failureRedirect: "/login", session: false }), googleCallback);

export default router;
