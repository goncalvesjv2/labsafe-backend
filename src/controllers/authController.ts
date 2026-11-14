import { FastifyReply, FastifyRequest } from "fastify";
import { loginService } from "../services/authService";
import { loginSchema } from "../schemas/authSchema";
import { IPayload } from "../interfaces/IPayload";
import { listUserByIdService } from "../services/userService";

export async function loginController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const result = loginSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: result.error.issues
            });
        }

        const { email, password } = result.data;
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
