import { FastifyReply, FastifyRequest } from "fastify";
import { IPayload } from "../interfaces/IPayload";
import { listUserByIdRepository } from "../repositories/userRepository";
import { createLogService } from "../services/logService";
import { UserRole } from "../utils/user";

export async function teacherAuthorizationMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const logged = request.user as IPayload;
    const user = await listUserByIdRepository(logged.sub);

    if (!user) {
        return reply.status(401).send({message: "Usuário não encontrado"});
    }

    if (user.role !== UserRole.PROFESSOR) {
        await createLogService({
            userId: user.id,
            action: "FALHA_AUTORIZACAO",
            description: "Usuário tentou acessar uma ação exclusiva de professor"
        });

        return reply.status(403).send({message: "Somente professores podem executar esta ação"});
    }
}