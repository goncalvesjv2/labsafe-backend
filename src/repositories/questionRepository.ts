import { prisma } from "../database/prisma";
import type { ICreateQuestion, IQuestion } from "../interfaces/IQuestion";

export async function listQuestionsRepository(): Promise<IQuestion[]> {
    const questions = await prisma.question.findMany({
        orderBy: { id: "asc" }
    });

    return questions.map((question) => ({
        id: question.id,
        quizId: question.quiz_id,
        statement: question.statement
    }));
}

export async function listQuestionByIdRepository(id: number): Promise<IQuestion | null> {
    const question = await prisma.question.findUnique({
        where: { id }
    });

    return question ? {
        id: question.id,
        quizId: question.quiz_id,
        statement: question.statement
    } : null;
}

export async function listQuestionsByQuizIdRepository(quizId: number): Promise<IQuestion[]> {
    const questions = await prisma.question.findMany({
        where: { quiz_id: quizId },
        orderBy: { id: "asc" }
    });

    return questions.map((question) => ({
        id: question.id,
        quizId: question.quiz_id,
        statement: question.statement
    }));
}

export async function countQuestionsByQuizIdRepository(quizId: number): Promise<number> {
    return prisma.question.count({
        where: { quiz_id: quizId }
    });
}

export async function createQuestionRepository(question: ICreateQuestion): Promise<IQuestion> {
    const newQuestion = await prisma.question.create({
        data: {
            quiz_id: question.quizId,
            statement: question.statement
        }
    });

    return {
        id: newQuestion.id,
        quizId: newQuestion.quiz_id,
        statement: newQuestion.statement
    };
}

export async function updateQuestionRepository(id: number, question: Partial<ICreateQuestion>): Promise<IQuestion> {
    const updatedQuestion = await prisma.question.update({
        where: { id },
        data: {
            quiz_id: question.quizId,
            statement: question.statement
        }
    });

    return {
        id: updatedQuestion.id,
        quizId: updatedQuestion.quiz_id,
        statement: updatedQuestion.statement
    };
}

export async function deleteQuestionRepository(id: number): Promise<void> {
    await prisma.question.delete({
        where: { id }
    });
}
