import "dotenv/config";
import fastifyCors from "@fastify/cors";
import Fastify from "fastify";
import { userRoutes } from "./routes/userRoutes";
import { authRoutes } from "./routes/authRoutes";
import fastifyJwt from "@fastify/jwt";

export const app = Fastify({ logger: true });

app.register(fastifyCors, {
    origin: "*",
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