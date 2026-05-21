import axios from "axios";

const authClient = axios.create({
    baseURL: "http://localhost:3001",
});

export default authClient;
