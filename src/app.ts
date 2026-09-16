import fastifyCors from "@fastify/cors";
import Fastify from "fastify";

export const app = Fastify({ logger: true });

app.register(fastifyCors, {
    origin: "*",
})