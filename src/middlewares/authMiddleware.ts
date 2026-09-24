import { FastifyRequest } from "fastify";

export async function authMiddleware (request: FastifyRequest) {
    await request.jwtVerify();
}