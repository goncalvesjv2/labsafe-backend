import { prisma } from "../database/prisma";
import type { IAnswer, ICreateAnswer } from "../interfaces/IAnswer";

export async function listAnswersByAttemptIdRepository(attemptId: number): Promise<IAnswer[]> {
    const answers = await prisma.answer.findMany({
        where: { attempt_id: attemptId },
        orderBy: { id: "asc" }
    });

    return answers.map((answer) => ({
        id: answer.id,
        attemptId: answer.attempt_id,
        questionId: answer.question_id,
        alternativeId: answer.alternative_id
    }));
}

export async function createAnswerRepository(answers: ICreateAnswer[]): Promise<IAnswer[]> {
    const newAnswers = await prisma.answer.createManyAndReturn({
        data: answers.map((answer) => ({
            attempt_id: answer.attemptId,
            question_id: answer.questionId,
            alternative_id: answer.alternativeId
        }))
    });

    return newAnswers.map((answer) => ({
        id: answer.id,
        attemptId: answer.attempt_id,
        questionId: answer.question_id,
        alternativeId: answer.alternative_id
    }));
}
