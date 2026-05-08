import { Router } from "express";
import passport from "../config/passport";

// Router is a mini Express app — define routes here, then attach to main app in index.ts
const router = Router();

// Route 1: Redirect user to Google's login page
// scope tells Google what info we want access to: profile (name, photo) and email
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"]}));

// Route 2: Google redirects user back here after login with an authorization code
// passport.authenticate exchanges the code for an access token, then fetches user info from Google
// session: false — we use JWT instead of server-side sessions
// If authentication fails, redirect to /login; if successful, run the next handler
router.get("/google/callback", passport.authenticate("google", { failureRedirect: "/login", session: false }), (req, res) => {
    // TODO: issue JWT here instead of this placeholder response
    res.send("Login succesful!");
})

export default router;
