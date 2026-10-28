import { FastifyReply, FastifyRequest } from "fastify";
import { createContentService, deleteContentService, listContentByIdService, listContentsService, updateContentService } from "../services/contentService";
import { contentSchema, updateSchema } from "../schemas/contentSchema";
import { IPayload } from "../interfaces/IPayload";

export async function listContentsController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const contents = await listContentsService();
        return reply.status(200).send(contents);
    } catch (error) {
        return reply.status(500).send(error);
    }
}

export async function listContentByIdController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if(!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const content = await listContentByIdService(id);
        return reply.status(200).send(content);
    } catch (error) {
        return reply.status(404).send(error);
    }
}

export async function createContentController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const result = contentSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: result.error.issues
            })
        }

        const logged = request.user as IPayload;
        const content = await createContentService(result.data, logged.sub);
        return reply.status(201).send(content);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function updateContentController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const result = updateSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: result.error.issues
            });
        }

        const logged = request.user as IPayload;
        const content = await updateContentService(id, result.data, logged.sub);
        return reply.status(200).send(content);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function deleteContentController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const logged = request.user as IPayload;
        await deleteContentService(id, logged.sub);
        return reply.status(204).send();
    } catch (error) {
        return reply.status(500).send(error);
    }
}