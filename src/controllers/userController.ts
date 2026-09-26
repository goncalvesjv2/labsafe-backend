import { FastifyReply, FastifyRequest } from "fastify";
import { createUserService, deleteUserService, listUserByIdService, listUsersService, updateUserService } from "../services/userService";
import { ICreateUser } from "../interfaces/IUser";
import { IPayload } from "../interfaces/IPayload";

export async function listUsersController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const users = await listUsersService();
        return reply.status(200).send(users);
    } catch (error) {
        return reply.status(500).send(error);
    }
}

export async function listUserByIdController(request: FastifyRequest<{Params: {id: number}}>, reply: FastifyReply) {
    try {
        const { id } = request.params;
        const user = await listUserByIdService(id);
        return reply.status(200).send(user);
    } catch (error){
        return reply.status(404).send(error);
    }
}

export async function createUserController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const user: ICreateUser = request.body as ICreateUser;
        const logged = request.user as IPayload;
        const createUser = await createUserService(user, logged.sub);
        return reply.status(201).send(createUser);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function updateUserController(request: FastifyRequest<{Params: {id: number}}>, reply: FastifyReply) {
    try {
        const { id } = request.params;
        const user: ICreateUser = request.body as ICreateUser;
        const logged = request.user as IPayload;
        const updateUser = await updateUserService(id, user, logged.sub);
        return reply.status(200).send(updateUser);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function deleteUserController(request: FastifyRequest<{Params: {id: number}}>, reply: FastifyReply) {
    try {
        const { id } = request.params;
        const logged = request.user as IPayload;
        await deleteUserService(id, logged.sub);
        return reply.status(204).send();
    } catch (error) {
        return reply.status(400).send(error);
    }
}