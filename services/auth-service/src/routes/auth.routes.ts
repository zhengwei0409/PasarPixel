import { Router } from "express";
import passport from "../config/passport";
import { register, login, refreshToken, logout, googleCallback, forgotPassword, resetPassword, me } from "../controllers/auth.controller";
import { setupTwoFactor, enableTwoFactor, disableTwoFactor } from "../controllers/twoFactor.controller";
import { requireAuth } from "../middleware/requireAuth";

// Router is a mini Express app — define routes here, then attach to main app in index.ts
const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", me);

// 2FA management — all require a logged-in user (valid access token)
router.post("/2fa/setup", requireAuth, setupTwoFactor);
router.post("/2fa/enable", requireAuth, enableTwoFactor);
router.post("/2fa/disable", requireAuth, disableTwoFactor);

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"]}));

router.get("/google/callback", passport.authenticate("google", { failureRedirect: "/login", session: false }), googleCallback);

export default router;
