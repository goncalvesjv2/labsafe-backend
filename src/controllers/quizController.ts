import type { FastifyReply, FastifyRequest } from "fastify";
import { createQuizService, deleteQuizService, listQuizByIdService, listQuizzesService, updateQuizService } from "../services/quizService";
import { quizSchema } from "../schemas/quizSchema";
import type { IPayload } from "../interfaces/IPayload";

export async function listQuizzesController(_request: FastifyRequest, reply: FastifyReply) {
    try {
        const quizzes = await listQuizzesService();
        return reply.status(200).send(quizzes);
    } catch (error) {
        return reply.status(500).send(error);
    }
}

export async function listQuizByIdController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const quiz = await listQuizByIdService(id);
        return reply.status(200).send(quiz);
    } catch (error) {
        return reply.status(404).send(error);
    }
}

export async function createQuizController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const result = quizSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: result.error.issues
            });
        }

        const logged = request.user as IPayload;
        const quiz = await createQuizService(result.data, logged.sub);
        return reply.status(201).send(quiz);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function updateQuizController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const result = quizSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: result.error.issues
            });
        }

        const logged = request.user as IPayload;
        const quiz = await updateQuizService(id, result.data, logged.sub);
        return reply.status(200).send(quiz);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function deleteQuizController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const logged = request.user as IPayload;
        await deleteQuizService(id, logged.sub);
        return reply.status(204).send();
    } catch (error) {
        return reply.status(500).send(error);
    }
}