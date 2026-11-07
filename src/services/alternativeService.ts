import type { ICreateAlternative } from "../interfaces/IAlternative";
import { changeCorrectRepository, countAlternativesByQuestionIdRepository, createAlternativeRepository, deleteAlternativeRepository, listAlternativeByIdRepository, listAlternativesByQuestionIdRepository, listAlternativesRepository, updateAlternativeRepository } from "../repositories/alternativeRepository";
import { listQuestionByIdRepository } from "../repositories/questionRepository";
import { listQuizByIdRepository } from "../repositories/quizRepository";
import { listUserByIdRepository } from "../repositories/userRepository";
import { UserRole } from "../utils/user";
import { createLogService } from "./logService";

export async function listAlternativesService() {
    const alternatives = await listAlternativesRepository();
    return alternatives;
}

export async function listAlternativeByIdService(id: number) {
    const alternative = await listAlternativeByIdRepository(id);

    if (!alternative) {
        throw new Error("Alternativa não encontrada");
    }

    return alternative;
}

export async function listAlternativesByQuestionIdService(questionId: number) {
    const question = await listQuestionByIdRepository(questionId);

    if (!question) {
        throw new Error("Questão não encontrada");
    }

    const alternatives = await listAlternativesByQuestionIdRepository(questionId);
    return alternatives;
}

export async function createAlternativeService(alternatives: ICreateAlternative[], teacherId: number) {
    const teacher = await listUserByIdRepository(teacherId);

    if (!teacher) {
        throw new Error("Usuário não encontrado");
    }

    if (teacher.role !== UserRole.PROFESSOR) {
        throw new Error("Somente professores podem criar alternativas");
    }

    if (!Array.isArray(alternatives) || alternatives.length === 0) {
        throw new Error("Informe as alternativas da questão");
    }

    const questionId = alternatives[0].questionId;
    const question = await listQuestionByIdRepository(questionId);

    if (!question) {
        throw new Error("Questão não encontrada");
    }

    const quiz = await listQuizByIdRepository(question.quizId);

    if (!quiz) {
        throw new Error("Quiz não encontrado");
    }

    if (quiz.teacherId !== teacherId) {
        throw new Error("Você pode somente criar alternativas nos seus próprios quizzes");
    }

    const totalAlternatives = await countAlternativesByQuestionIdRepository(questionId);
    const newTotal = totalAlternatives + alternatives.length;

    if (newTotal < 2) {
        throw new Error("A questão deve ter no mínimo 2 alternativas");
    }

    if (newTotal > 4) {
        throw new Error("A questão pode ter no máximo 4 alternativas");
    }

    const data = alternatives.map((alternative) => {
        if (alternative.questionId !== questionId) {
            throw new Error("As alternativas devem pertencer à mesma questão");
        }

        const text = alternative.text.trim();

        if (!text) {
            throw new Error("O texto da alternativa é obrigatório");
        }

        return { ...alternative, text };
    });

    const existingAlternatives = await listAlternativesByQuestionIdRepository(questionId);
    const existingCorrect = existingAlternatives.filter((alternative) => alternative.correct === true).length;
    const newCorrect = data.filter((alternative) => alternative.correct === true).length;

    if (existingCorrect + newCorrect !== 1) {
        throw new Error("A questão deve ter exatamente 1 alternativa correta");
    }

    const newAlternatives = await createAlternativeRepository(data);

    for (const newAlternative of newAlternatives) {
        await createLogService({
            userId: teacherId,
            action: "CADASTRO_ALTERNATIVA",
            description: `O usuário com o e-mail ${teacher.email} criou a alternativa de ID ${newAlternative.id} na questão de ID ${questionId}`
        });
    }

    return newAlternatives;
}

export async function updateAlternativeService(id: number, alternative: { text: string }, teacherId: number) {
    const teacher = await listUserByIdRepository(teacherId);

    if (!teacher) {
        throw new Error("Usuário não encontrado");
    }

    if (teacher.role !== UserRole.PROFESSOR) {
        throw new Error("Somente professores podem atualizar alternativas");
    }

    const existingAlternative = await listAlternativeByIdService(id);
    const currentQuestion = await listQuestionByIdRepository(existingAlternative.questionId);

    if (!currentQuestion) {
        throw new Error("Questão não encontrada");
    }

    const currentQuiz = await listQuizByIdRepository(currentQuestion.quizId);

    if (!currentQuiz) {
        throw new Error("Quiz não encontrado");
    }

    if (currentQuiz.teacherId !== teacherId) {
        throw new Error("Você pode somente atualizar alternativas dos seus próprios quizzes");
    }

    if (typeof alternative.text !== "string") {
        throw new Error("O texto da alternativa é obrigatório");
    }

    const text = alternative.text.trim();

    if (!text) {
        throw new Error("O texto da alternativa é obrigatório");
    }

    const updatedAlternative = await updateAlternativeRepository(id, { text });

    await createLogService({
        userId: teacherId,
        action: "ALTERACAO_ALTERNATIVA",
        description: `O usuário com o e-mail ${teacher.email} atualizou o texto da alternativa de ID ${id} na questão de ID ${existingAlternative.questionId}`
    });

    return updatedAlternative;
}

export async function changeCorrectService(id: number, teacherId: number) {
    const teacher = await listUserByIdRepository(teacherId);

    if (!teacher) {
        throw new Error("Usuário não encontrado");
    }

    if (teacher.role !== UserRole.PROFESSOR) {
        throw new Error("Somente professores podem alterar a alternativa correta");
    }

    const alternative = await listAlternativeByIdService(id);
    const question = await listQuestionByIdRepository(alternative.questionId);

    if (!question) {
        throw new Error("Questão não encontrada");
    }

    const quiz = await listQuizByIdRepository(question.quizId);

    if (!quiz) {
        throw new Error("Quiz não encontrado");
    }

    if (quiz.teacherId !== teacherId) {
        throw new Error("Você pode somente alterar a alternativa correta dos seus próprios quizzes");
    }

    const updatedAlternative = await changeCorrectRepository(id, alternative.questionId);

    await createLogService({
        userId: teacherId,
        action: "ALTERACAO_ALTERNATIVA_CORRETA",
        description: `O usuário com o e-mail ${teacher.email} alterou a alternativa correta da questão de ID ${alternative.questionId} para a alternativa de ID ${id}`
    });

    return updatedAlternative;
}

export async function deleteAlternativeService(id: number, teacherId: number) {
    const teacher = await listUserByIdRepository(teacherId);

    if (!teacher) {
        throw new Error("Usuário não encontrado");
    }

    if (teacher.role !== UserRole.PROFESSOR) {
        throw new Error("Somente professores podem excluir alternativas");
    }

    const alternative = await listAlternativeByIdService(id);
    const question = await listQuestionByIdRepository(alternative.questionId);

    if (!question) {
        throw new Error("Questão não encontrada");
    }

    const quiz = await listQuizByIdRepository(question.quizId);

    if (!quiz) {
        throw new Error("Quiz não encontrado");
    }

    if (quiz.teacherId !== teacherId) {
        throw new Error("Você só pode excluir alternativas dos seus próprios quizzes");
    }

    const totalAlternatives = await countAlternativesByQuestionIdRepository(alternative.questionId);

    if (totalAlternatives <= 2) {
        throw new Error("A questão deve ter no mínimo 2 alternativas");
    }

    const alternatives = await listAlternativesByQuestionIdRepository(alternative.questionId);
    const remainingCorrect = alternatives.filter((alternative) => alternative.id !== id && alternative.correct === true).length;

    if (remainingCorrect !== 1) {
        throw new Error("A questão deve manter exatamente 1 alternativa correta");
    }

    await deleteAlternativeRepository(id);

    await createLogService({
        userId: teacherId,
        action: "EXCLUSAO_ALTERNATIVA",
        description: `O usuário com o e-mail ${teacher.email} excluiu a alternativa de ID ${id} da questão de ID ${alternative.questionId}`
    });
}