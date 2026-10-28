import "dotenv/config";
import fastifyCors from "@fastify/cors";
import Fastify from "fastify";
import { userRoutes } from "./routes/userRoutes";
import { authRoutes } from "./routes/authRoutes";
import fastifyJwt from "@fastify/jwt";
import { pubChemRoutes } from "./routes/pubChemRoutes";
import { contentRoutes } from "./routes/contentRoutes";

export const app = Fastify({ logger: true });

app.register(fastifyCors, {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
})

const secretJWT = process.env.JWT_SECRET;

if (!secretJWT) {
    throw new Error("Chave secreta do JWT não configurado")
}

app.register(fastifyJwt, {
    secret: secretJWT,
})

app.register(userRoutes, { prefix: '/api' });
app.register(authRoutes, { prefix: '/auth' });
app.register(pubChemRoutes, { prefix: '/api' });
app.register(contentRoutes, { prefix: "/api" });