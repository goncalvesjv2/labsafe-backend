import type { FastifyReply, FastifyRequest } from "fastify";
import { loginService } from "../services/authService";
import type { ILogin } from "../interfaces/ILogin";
import type { IPayload } from "../interfaces/IPayload";
import { listUserByIdService } from "../services/userService";

export async function loginController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const { email, password } = request.body as ILogin;
        const login = await loginService(email, password);
        return reply.status(200).send(login);        
    } catch (error) {
        return reply.status(401).send(error);
    }
}
export async function getProfileController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const logged = request.user as IPayload;
        const user = await listUserByIdService(logged.sub);
        return reply.status(200).send({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            ativo: user.ativo,
        });
    } catch (error) {
        return reply.status(404).send(error);
    }
}
