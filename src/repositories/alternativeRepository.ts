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

export async function createAlternativeRepository(alternatives: ICreateAlternative[]): Promise<IAlternative[]> {
    const newAlternatives = await prisma.alternative.createManyAndReturn({
        data: alternatives.map((alternative) => ({
            question_id: alternative.questionId,
            text: alternative.text,
            correct: alternative.correct
        }))
    });

    return newAlternatives.map((alternative) => ({
        id: alternative.id,
        questionId: alternative.question_id,
        text: alternative.text,
        correct: alternative.correct
    }));
}

export async function updateAlternativeRepository(id: number, alternative: { text?: string }): Promise<IAlternative> {
    const updatedAlternative = await prisma.alternative.update({
        where: { id },
        data: {
            text: alternative.text
        }
    });

    return {
        id: updatedAlternative.id,
        questionId: updatedAlternative.question_id,
        text: updatedAlternative.text,
        correct: updatedAlternative.correct
    };
}

export async function changeCorrectRepository(id: number, questionId: number): Promise<IAlternative> {
    const [, updated] = await prisma.$transaction([
        prisma.alternative.updateMany({
            where: {
                question_id: questionId,
                correct: true,
                id: { not: id }
            },
            data: { correct: false }
        }),
        prisma.alternative.update({
            where: { id, question_id: questionId },
            data: { correct: true }
        })
    ], { isolationLevel: "Serializable" });

    return {
        id: updated.id,
        questionId: updated.question_id,
        text: updated.text,
        correct: updated.correct
    };
}

export async function deleteAlternativeRepository(id: number): Promise<void> {
    await prisma.alternative.delete({
        where: { id }
    });
}
