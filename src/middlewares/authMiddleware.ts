import { FastifyReply, FastifyRequest } from "fastify";
import type { IPayload } from "../interfaces/IPayload";
import { listUserByIdRepository } from "../repositories/userRepository";

export async function authMiddleware (request: FastifyRequest, reply: FastifyReply) {
    await request.jwtVerify();

    const logged = request.user as IPayload;

    if (!Number.isSafeInteger(logged.sub) || logged.sub <= 0) {
        return reply.status(401).send({message: "Token inválido"});
    }

    const user = await listUserByIdRepository(logged.sub);

    if (!user) {
        return reply.status(401).send({message: "Usuário não encontrado"});
    }

    if (!user.ativo) {
        return reply.status(401).send({message: "Usuário inativo"});
    }

    logged.role = user.role;
}
