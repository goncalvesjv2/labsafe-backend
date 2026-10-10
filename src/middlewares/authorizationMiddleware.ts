import { FastifyReply, FastifyRequest } from "fastify";
import { UserRole } from "../utils/user";
import { IPayload } from "../interfaces/IPayload";
import { createLogService } from "../services/logService";

export async function authorizationMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as IPayload;
   
    if (user.role !== UserRole.ADMIN) {
        await createLogService({
            userId: user.sub,
            action: "FALHA_AUTORIZACAO",
            description: "Usuário tentou acessar sem permissão"
        })
        
        reply.status(403).send({message: "Acesso não autorizado"})
        return;
    }
}