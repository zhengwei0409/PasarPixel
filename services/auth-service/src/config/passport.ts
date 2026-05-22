import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "../lib/prisma";

// Tell Passport to use Google OAuth 2.0 as the authentication strategy
passport.use(new GoogleStrategy({
    // clientID + clientSecret prove to Google that this request comes from our registered app
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    // Google will redirect the user back to this URL after login
    callbackURL: "http://localhost:3001/auth/google/callback",
}, async (accessToken, refreshToken, profile, done) => {
    // This verify callback runs after Google confirms the user's identity
    // profile contains the user's Google info (email, name, photo)
    // done(null, profile) tells Passport "success, here is the user"
    // done(error, false) tells Passport "something went wrong, login failed"
    try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
            return done(new Error("Google account did not return an email"), false);
        }

        // 1. Returning Google user
        let user = await prisma.user.findUnique({ where: { googleId: profile.id } });

        // 2. Existing email account — link Google to it
        if (!user) {
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
                user = await prisma.user.update({
                    where: { id: existing.id },
                    data: { googleId: profile.id, isVerified: true },
                });
            }
        }

        // 3. Brand new user
        if (!user) {
            user = await prisma.user.create({
                data: { googleId: profile.id, email, isVerified: true },
            });
        }

        done(null, user);
    } catch (error) {
        done(error as Error, false);
    }
}));

export default passport;
