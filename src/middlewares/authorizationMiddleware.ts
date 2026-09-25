import { FastifyReply, FastifyRequest } from "fastify";
import { UserRole } from "../utils/user";
import { IPayload } from "../interfaces/IPayload";

export async function authorizationMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as IPayload;
   
    if (user.role !== UserRole.ADMIN) {
        reply.status(403).send({message: "Acesso não autorizado"})
        return;
    }
}