import express from "express";

const app = express();
const PORT = 3001;

app.use(express.json());

app.get('/health', (req,res) => {
    res.json({status: 'ok', service: 'auth-service'});
})

app.listen(PORT, () => {
    console.log(`Auth service running on port ${PORT}`);
})