import axios from "axios";

const authApi = axios.create({
    baseURL: "http://localhost:3001",
});

export default authApi;
