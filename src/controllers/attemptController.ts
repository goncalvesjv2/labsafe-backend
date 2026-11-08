import { FastifyReply, FastifyRequest } from "fastify";
import { createAttemptService, listAttemptByIdService, listAttemptsByQuizIdService, listAttemptsByStudentAndQuizIdService } from "../services/attemptService";
import { attemptSchema } from "../schemas/attemptSchema";
import { IPayload } from "../interfaces/IPayload";

export async function listAttemptByIdController(request: FastifyRequest<{Params: {id: string}}>, reply: FastifyReply) {
    try {
        const id = Number(request.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const logged = request.user as IPayload;
        const attempt = await listAttemptByIdService(id, logged.sub);
        return reply.status(200).send(attempt);
    } catch (error) {
        return reply.status(404).send(error);
    }
}

export async function listAttemptsByQuizIdController(request: FastifyRequest<{Params: {quizId: string}}>, reply: FastifyReply) {
    try {
        const quizId = Number(request.params.quizId);

        if (!Number.isInteger(quizId) || quizId <= 0) {
            return reply.status(400).send({message: "ID inválido"});
        }

        const logged = request.user as IPayload;
        const attempts = await listAttemptsByQuizIdService(quizId, logged.sub);
        return reply.status(200).send(attempts);
    } catch (error) {
        return reply.status(404).send(error);
    }
}

export async function listAttemptsByStudentAndQuizIdController(request: FastifyRequest<{Params: {studentId: string, quizId: string}}>, reply: FastifyReply) {
    try {
        const studentId = Number(request.params.studentId);
        const quizId = Number(request.params.quizId);

        if (!Number.isInteger(studentId) || studentId <= 0) {
            return reply.status(400).send({message: "ID do aluno inválido"});
        }

        if (!Number.isInteger(quizId) || quizId <= 0) {
            return reply.status(400).send({message: "ID do quiz inválido"});
        }

        const logged = request.user as IPayload;
        const attempts = await listAttemptsByStudentAndQuizIdService(studentId, quizId, logged.sub);
        return reply.status(200).send(attempts);
    } catch (error) {
        return reply.status(404).send(error);
    }
}

export async function createAttemptController(request: FastifyRequest, reply: FastifyReply) {
    try {
        const result = attemptSchema.safeParse(request.body);

        if (!result.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: result.error.issues
            });
        }

        const logged = request.user as IPayload;
        const attempt = await createAttemptService(result.data, logged.sub);
        return reply.status(201).send(attempt);
    } catch (error) {
        return reply.status(400).send(error);
    }
}
