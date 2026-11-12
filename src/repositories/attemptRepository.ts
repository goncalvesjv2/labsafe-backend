import { prisma } from "../database/prisma";
import type { Prisma } from "../generated/prisma/client";
import type { IAttempt, IAttemptWithStudent, ICreateAttempt } from "../interfaces/IAttempt";

export async function listAttemptsRepository(): Promise<IAttemptWithStudent[]> {
    const attempts = await prisma.attempt.findMany({
        include: { student: { select: { name: true } } },
        orderBy: { id: "asc" }
    });

    return attempts.map((attempt) => ({
        id: attempt.id,
        quizId: attempt.quiz_id,
        studentId: attempt.student_id,
        studentName: attempt.student.name,
        score: Number(attempt.score),
        approved: attempt.approved,
        createdAt: attempt.created_at
    }));
}

export async function listAttemptByIdRepository(id: number): Promise<IAttemptWithStudent | null> {
    const attempt = await prisma.attempt.findUnique({
        where: { id },
        include: { student: { select: { name: true } } }
    });

    return attempt ? {
        id: attempt.id,
        quizId: attempt.quiz_id,
        studentId: attempt.student_id,
        studentName: attempt.student.name,
        score: Number(attempt.score),
        approved: attempt.approved,
        createdAt: attempt.created_at
    } : null;
}

export async function listAttemptsByStudentIdRepository(studentId: number): Promise<IAttemptWithStudent[]> {
    const attempts = await prisma.attempt.findMany({
        where: { student_id: studentId },
        include: { student: { select: { name: true } } },
        orderBy: { id: "asc" }
    });

    return attempts.map((attempt) => ({
        id: attempt.id,
        quizId: attempt.quiz_id,
        studentId: attempt.student_id,
        studentName: attempt.student.name,
        score: Number(attempt.score),
        approved: attempt.approved,
        createdAt: attempt.created_at
    }));
}

export async function listAttemptsByQuizIdRepository(quizId: number): Promise<IAttemptWithStudent[]> {
    const attempts = await prisma.attempt.findMany({
        where: { quiz_id: quizId },
        include: { student: { select: { name: true } } },
        orderBy: { id: "asc" }
    });

    return attempts.map((attempt) => ({
        id: attempt.id,
        quizId: attempt.quiz_id,
        studentId: attempt.student_id,
        studentName: attempt.student.name,
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
