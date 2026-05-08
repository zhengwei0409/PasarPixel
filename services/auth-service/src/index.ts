import express from "express";
import passport from "./config/passport";
import router from "./routes/auth.routes";

const app = express();
const PORT = 3001;

app.use(express.json());

// Initialize Passport — must be registered before any routes that use it
app.use(passport.initialize());

// Mount auth routes under /auth prefix — e.g. /auth/google, /auth/google/callback
app.use("/auth", router);

app.get('/health', (req,res) => {
    res.json({status: 'ok', service: 'auth-service'});
})

app.listen(PORT, () => {
    console.log(`Auth service running on port ${PORT}`);
})