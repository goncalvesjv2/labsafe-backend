import type { FastifyReply, FastifyRequest } from "fastify";
import type { IPayload } from "../interfaces/IPayload";
import { listUserByIdRepository } from "../repositories/userRepository";
import { createLogService } from "../services/logService";
import { UserRole } from "../utils/user";

export async function questionAuthorizationMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const logged = request.user as IPayload;
    const user = await listUserByIdRepository(logged.sub);

    if (!user) {
        return reply.status(401).send({message: "Usuário não encontrado"});
    }

    if (user.role !== UserRole.PROFESSOR && user.role !== UserRole.ALUNO) {
        await createLogService({
            userId: user.id,
            action: "FALHA_AUTORIZACAO",
            description: "Usuário tentou acessar uma ação exclusiva de professor ou aluno"
        });

        return reply.status(403).send({message: "Somente professores e alunos podem acessar as questões"});
    }
}
