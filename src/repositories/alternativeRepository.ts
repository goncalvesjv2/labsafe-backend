import { prisma } from "../database/prisma";
import type { IAlternative, ICreateAlternative } from "../interfaces/IAlternative";

export async function listAlternativesRepository(): Promise<IAlternative[]> {
    const alternatives = await prisma.alternative.findMany({
        orderBy: { id: "asc" }
    });

    return alternatives.map((alternative) => ({
        id: alternative.id,
        questionId: alternative.question_id,
        text: alternative.text,
        correct: alternative.correct
    }));
}

export async function listAlternativeByIdRepository(id: number): Promise<IAlternative | null> {
    const alternative = await prisma.alternative.findUnique({
        where: { id }
    });

    return alternative ? {
        id: alternative.id,
        questionId: alternative.question_id,
        text: alternative.text,
        correct: alternative.correct
    } : null;
}

export async function listAlternativesByQuestionIdRepository(questionId: number): Promise<IAlternative[]> {
    const alternatives = await prisma.alternative.findMany({
        where: { question_id: questionId },
        orderBy: { id: "asc" }
    });

    return alternatives.map((alternative) => ({
        id: alternative.id,
        questionId: alternative.question_id,
        text: alternative.text,
        correct: alternative.correct
    }));
}

export async function countAlternativesByQuestionIdRepository(questionId: number): Promise<number> {
    return prisma.alternative.count({
        where: { question_id: questionId }
    });
}

export async function createAlternativeRepository(alternative: ICreateAlternative): Promise<IAlternative> {
    const newAlternative = await prisma.alternative.create({
        data: {
            question_id: alternative.questionId,
            text: alternative.text,
            correct: alternative.correct
        }
    });

    return {
        id: newAlternative.id,
        questionId: newAlternative.question_id,
        text: newAlternative.text,
        correct: newAlternative.correct
    };
}

export async function updateAlternativeRepository(id: number, alternative: Partial<ICreateAlternative>): Promise<IAlternative> {
    const updatedAlternative = await prisma.alternative.update({
        where: { id },
        data: {
            question_id: alternative.questionId,
            text: alternative.text,
            correct: alternative.correct
        }
    });

    return {
        id: updatedAlternative.id,
        questionId: updatedAlternative.question_id,
        text: updatedAlternative.text,
        correct: updatedAlternative.correct
    };
}

export async function deleteAlternativeRepository(id: number): Promise<void> {
    await prisma.alternative.delete({
        where: { id }
    });
}