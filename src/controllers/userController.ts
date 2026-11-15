import { FastifyReply, FastifyRequest } from "fastify";
import { acceptUserInvitationService, changeUserStatusService, createUserService, deleteUserService, listUserByIdService, listUsersService, resendUserInvitationService, updateUserService } from "../services/userService";
import { IPayload } from "../interfaces/IPayload";
import { changeUserStatusSchema, userSchema, updateUserSchema } from "../schemas/userSchema";
import { acceptInvitationSchema } from "../schemas/invitationSchema";

export async function listUsersController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const users = await listUsersService();
        return reply.status(200).send(users);
    } catch (error) {
        return reply.status(500).send(error);
    }
}

export async function listUserByIdController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if(!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const user = await listUserByIdService(id);
        return reply.status(200).send(user);
    } catch (error){
        return reply.status(404).send(error);
    }
}

export async function createUserController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const result = userSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: result.error.issues
            });
        }

        const logged = request.user as IPayload;
        const createUser = await createUserService(result.data, logged.sub);
        return reply.status(201).send(createUser);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function resendUserInvitationController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return reply.status(400).send({ message: "ID inválido" });
        }

        const logged = request.user as IPayload;
        const invitation = await resendUserInvitationService(id, logged.sub);
        return reply.status(200).send(invitation);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function acceptUserInvitationController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const result = acceptInvitationSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: result.error.issues
            });
        }

        const { token, password } = result.data;
        const invitation = await acceptUserInvitationService(token, password);
        return reply.status(200).send(invitation);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function updateUserController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const result = updateUserSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: result.error.issues
            });
        }

        const logged = request.user as IPayload;
        const updateUser = await updateUserService(id, result.data, logged.sub);
        return reply.status(200).send(updateUser);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function changeUserStatusController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const result = changeUserStatusSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: result.error.issues
            });
        }

        const logged = request.user as IPayload;
        const user = await changeUserStatusService(id, result.data.ativo, logged.sub);
        return reply.status(200).send(user);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function deleteUserController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }
        const logged = request.user as IPayload;
        await deleteUserService(id, logged.sub);
        return reply.status(204).send();
    } catch (error) {
        if (error instanceof Error && error.message === "Você não pode excluir sua própria conta") {
            return reply.status(403).send({message: error.message});
        }

        return reply.status(400).send(error);
    }
}
