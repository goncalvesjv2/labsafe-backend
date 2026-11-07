import { FastifyReply, FastifyRequest } from "fastify";
import { changeCorrectService, createAlternativeService, deleteAlternativeService, listAlternativeByIdService, listAlternativesByQuestionIdService, listAlternativesService, updateAlternativeService } from "../services/alternativeService";
import { alternativeSchema, updateAlternativeSchema } from "../schemas/alternativeSchema";
import { IPayload } from "../interfaces/IPayload";

export async function listAlternativesController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const logged = request.user as IPayload;
        const alternatives = await listAlternativesService(logged.sub);
        return reply.status(200).send(alternatives);
    } catch (error) {
        return reply.status(500).send(error);
    }
}

export async function listAlternativeByIdController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const logged = request.user as IPayload;
        const alternative = await listAlternativeByIdService(id, logged.sub);
        return reply.status(200).send(alternative);
    } catch (error) {
        return reply.status(404).send(error);
    }
}

export async function listAlternativesByQuestionIdController(request: FastifyRequest<{Params: {questionId: string}}>, reply: FastifyReply) {
    try {
        const questionId = Number(request.params.questionId);

        if (!Number.isInteger(questionId) || questionId <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const logged = request.user as IPayload;
        const alternatives = await listAlternativesByQuestionIdService(questionId, logged.sub);
        return reply.status(200).send(alternatives);
    } catch (error) {
        return reply.status(404).send(error);
    }
}

export async function createAlternativeController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const result = alternativeSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: result.error.issues
            });
        }

        const logged = request.user as IPayload;
        const alternatives = await createAlternativeService(result.data, logged.sub);
        return reply.status(201).send(alternatives);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function updateAlternativeController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const result = updateAlternativeSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: result.error.issues
            });
        }

        const logged = request.user as IPayload;
        const alternative = await updateAlternativeService(id, result.data, logged.sub);
        return reply.status(200).send(alternative);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function changeCorrectController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const logged = request.user as IPayload;
        const alternative = await changeCorrectService(id, logged.sub);
        return reply.status(200).send(alternative);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function deleteAlternativeController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const logged = request.user as IPayload;
        await deleteAlternativeService(id, logged.sub);
        return reply.status(204).send();
    } catch (error) {
        return reply.status(500).send(error);
    }
}
