import { prisma } from "../database/prisma";
import type { ICreateQuiz, IQuiz } from "../interfaces/IQuiz";

export async function listQuizzesRepository(): Promise<IQuiz[]> {
    const quizzes = await prisma.quiz.findMany();

    return quizzes.map((quiz) => ({
        id: quiz.id,
        contentId: quiz.conteudo_id,
        teacherId: quiz.professor_id
    }));
}

export async function listQuizByIdRepository(id: number): Promise<IQuiz | null> {
    const quiz = await prisma.quiz.findUnique({
        where: { id }
    });

    return quiz ? {
        id: quiz.id,
        contentId: quiz.conteudo_id,
        teacherId: quiz.professor_id
    } : null;
}

export async function listQuizByContentIdRepository(contentId: number): Promise<IQuiz | null> {
    const quiz = await prisma.quiz.findUnique({
        where: { conteudo_id: contentId }
    });

    return quiz ? {
        id: quiz.id,
        contentId: quiz.conteudo_id,
        teacherId: quiz.professor_id
    } : null;
}

export async function createQuizRepository(quiz: ICreateQuiz, teacherId: number): Promise<IQuiz> {
    const newQuiz = await prisma.quiz.create({
        data: {
            conteudo_id: quiz.contentId,
            professor_id: teacherId
        }
    });

    return {
        id: newQuiz.id,
        contentId: newQuiz.conteudo_id,
        teacherId: newQuiz.professor_id
    };
}

export async function updateQuizRepository(id: number, quiz: ICreateQuiz): Promise<IQuiz> {
    const updatedQuiz = await prisma.quiz.update({
        where: { id },
        data: {
            conteudo_id: quiz.contentId
        }
    });

    return {
        id: updatedQuiz.id,
        contentId: updatedQuiz.conteudo_id,
        teacherId: updatedQuiz.professor_id
    };
}

export async function deleteQuizRepository(id: number): Promise<void> {
    await prisma.$transaction([
        prisma.attempt.deleteMany({
            where: { quiz_id: id }
        }),
        prisma.quiz.delete({
            where: { id }
        })
    ]);
}
