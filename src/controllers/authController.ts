import { FastifyReply, FastifyRequest } from "fastify";
import { loginService } from "../services/authService";
import { ILogin } from "../interfaces/ILogin";

export async function loginController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const { email, password } = request.body as ILogin;
        const login = await loginService(email, password);
        return reply.status(200).send(login);        
    } catch (error) {
        return reply.status(401).send(error);
    }
}