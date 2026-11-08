import { prisma } from "../database/prisma";
import type { Prisma } from "../generated/prisma/client";
import type { IAttempt, ICreateAttempt } from "../interfaces/IAttempt";

export async function listAttemptsRepository(): Promise<IAttempt[]> {
    const attempts = await prisma.attempt.findMany({
        orderBy: { id: "asc" }
    });

    return attempts.map((attempt) => ({
        id: attempt.id,
        quizId: attempt.quiz_id,
        studentId: attempt.student_id,
        score: Number(attempt.score),
        approved: attempt.approved,
        createdAt: attempt.created_at
    }));
}

export async function listAttemptByIdRepository(id: number): Promise<IAttempt | null> {
    const attempt = await prisma.attempt.findUnique({
        where: { id }
    });

    return attempt ? {
        id: attempt.id,
        quizId: attempt.quiz_id,
        studentId: attempt.student_id,
        score: Number(attempt.score),
        approved: attempt.approved,
        createdAt: attempt.created_at
    } : null;
}

export async function listAttemptsByStudentIdRepository(studentId: number): Promise<IAttempt[]> {
    const attempts = await prisma.attempt.findMany({
        where: { student_id: studentId },
        orderBy: { id: "asc" }
    });

    return attempts.map((attempt) => ({
        id: attempt.id,
        quizId: attempt.quiz_id,
        studentId: attempt.student_id,
        score: Number(attempt.score),
        approved: attempt.approved,
        createdAt: attempt.created_at
    }));
}

export async function listAttemptsByQuizIdRepository(quizId: number): Promise<IAttempt[]> {
    const attempts = await prisma.attempt.findMany({
        where: { quiz_id: quizId },
        orderBy: { id: "asc" }
    });

    return attempts.map((attempt) => ({
        id: attempt.id,
        quizId: attempt.quiz_id,
        studentId: attempt.student_id,
        score: Number(attempt.score),
        approved: attempt.approved,
        createdAt: attempt.created_at
    }));
}

export async function createAttemptRepository(attempt: ICreateAttempt, transaction: Prisma.TransactionClient = prisma): Promise<IAttempt> {
    const newAttempt = await transaction.attempt.create({
        data: {
            quiz_id: attempt.quizId,
            student_id: attempt.studentId,
            score: attempt.score,
            approved: attempt.approved
        }
    });

    return {
        id: newAttempt.id,
        quizId: newAttempt.quiz_id,
        studentId: newAttempt.student_id,
        score: Number(newAttempt.score),
        approved: newAttempt.approved,
        createdAt: newAttempt.created_at
    };
}