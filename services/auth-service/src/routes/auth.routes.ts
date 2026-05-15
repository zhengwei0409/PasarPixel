import { Router } from "express";
import passport from "../config/passport";
import { register, login, refreshToken, logout, googleCallback, forgotPassword, resetPassword } from "../controllers/auth.controller";

// Router is a mini Express app — define routes here, then attach to main app in index.ts
const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"]}));

router.get("/google/callback", passport.authenticate("google", { failureRedirect: "/login", session: false }), googleCallback);

export default router;
