import type { FastifyReply, FastifyRequest } from "fastify";
import { createQuestionService, deleteQuestionService, listQuestionByIdService, listQuestionsByQuizIdService, listQuestionsService, updateQuestionService } from "../services/questionService";
import { questionSchema, updateQuestionSchema } from "../schemas/questionSchema";
import type { IPayload } from "../interfaces/IPayload";

export async function listQuestionsController(_request: FastifyRequest, reply: FastifyReply) {
    try {
        const questions = await listQuestionsService();
        return reply.status(200).send(questions);
    } catch (error) {
        return reply.status(500).send(error);
    }
}

export async function listQuestionByIdController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const question = await listQuestionByIdService(id);
        return reply.status(200).send(question);
    } catch (error) {
        return reply.status(404).send(error);
    }
}

export async function listQuestionsByQuizIdController(request: FastifyRequest<{Params: {quizId: string}}>, reply: FastifyReply) {
    try {
        const quizId = Number(request.params.quizId);

        if (!Number.isInteger(quizId) || quizId <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const questions = await listQuestionsByQuizIdService(quizId);
        return reply.status(200).send(questions);
    } catch (error) {
        return reply.status(404).send(error);
    }
}

export async function createQuestionController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const result = questionSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: result.error.issues
            });
        }

        const logged = request.user as IPayload;
        const question = await createQuestionService(result.data, logged.sub);
        return reply.status(201).send(question);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function updateQuestionController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const result = updateQuestionSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: result.error.issues
            });
        }

        const logged = request.user as IPayload;
        const question = await updateQuestionService(id, result.data, logged.sub);
        return reply.status(200).send(question);
    } catch (error) {
        return reply.status(400).send(error);
    }
}

export async function deleteQuestionController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const logged = request.user as IPayload;
        await deleteQuestionService(id, logged.sub);
        return reply.status(204).send();
    } catch (error) {
        return reply.status(500).send(error);
    }
}
