import fastifyCors from "@fastify/cors";
import Fastify from "fastify";
import { userRoutes } from "./routes/userRoutes";
import { authRoutes } from "./routes/authRoutes";

export const app = Fastify({ logger: true });

app.register(fastifyCors, {
    origin: "*",
})

app.register(userRoutes, { prefix: '/api' });
app.register(authRoutes, { prefix: '/auth' });