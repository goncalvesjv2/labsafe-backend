import type { ICreateQuestion } from "../interfaces/IQuestion";
import { countQuestionsByQuizIdRepository, createQuestionRepository, deleteQuestionRepository, listQuestionByIdRepository, listQuestionsByQuizIdRepository, listQuestionsRepository, updateQuestionRepository } from "../repositories/questionRepository";
import { listQuizByIdRepository } from "../repositories/quizRepository";
import { listContentByIdRepository } from "../repositories/contentRepository";
import { listUserByIdRepository } from "../repositories/userRepository";
import { UserRole } from "../utils/user";
import { createLogService } from "./logService";

export async function listQuestionsService() {
    const questions = await listQuestionsRepository();
    return questions;
}

export async function listQuestionByIdService(id: number) {
    const question = await listQuestionByIdRepository(id);

    if (!question) {
        throw new Error("Questão não encontrada");
    }

    return question;
}

export async function listQuestionsByQuizIdService(quizId: number) {
    const quiz = await listQuizByIdRepository(quizId);

    if (!quiz) {
        throw new Error("Quiz não encontrado");
    }

    const questions = await listQuestionsByQuizIdRepository(quizId);
    return questions;
}

export async function createQuestionService(question: ICreateQuestion, teacherId: number) {
    const teacher = await listUserByIdRepository(teacherId);

    if (!teacher) {
        throw new Error("Usuário não encontrado");
    }

    if (teacher.role !== UserRole.PROFESSOR) {
        throw new Error("Somente professores podem criar questões");
    }

    const quiz = await listQuizByIdRepository(question.quizId);

    if (!quiz) {
        throw new Error("Quiz não encontrado");
    }

    const content = await listContentByIdRepository(quiz.contentId);

    if (!content) {
        throw new Error("Conteúdo não encontrado");
    }

    if (quiz.teacherId !== teacherId) {
        throw new Error("Você pode somente criar questões nos seus próprios quizzes");
    }

    const statement = question.statement.trim();

    if (!statement) {
        throw new Error("O enunciado é obrigatório");
    }

    const totalQuestions = await countQuestionsByQuizIdRepository(question.quizId);

    if (totalQuestions >= 10) {
        throw new Error("O quiz pode ter no máximo 10 questões");
    }

    const newQuestion = await createQuestionRepository({ ...question, statement });

    await createLogService({
        userId: teacherId,
        action: "CADASTRO_QUESTAO",
        description: `O usuário com o e-mail ${teacher.email} criou a questão de ID ${newQuestion.id} no quiz de ID ${newQuestion.quizId}`
    });

    return newQuestion;
}

export async function updateQuestionService(id: number, question: { statement?: string }, teacherId: number) {
    const teacher = await listUserByIdRepository(teacherId);

    if (!teacher) {
        throw new Error("Usuário não encontrado");
    }

    if (teacher.role !== UserRole.PROFESSOR) {
        throw new Error("Somente professores podem atualizar questões");
    }

    const existingQuestion = await listQuestionByIdService(id);
    const currentQuiz = await listQuizByIdRepository(existingQuestion.quizId);

    if (!currentQuiz) {
        throw new Error("Quiz não encontrado");
    }

    const currentContent = await listContentByIdRepository(currentQuiz.contentId);

    if (!currentContent) {
        throw new Error("Conteúdo não encontrado");
    }

    if (currentQuiz.teacherId !== teacherId) {
        throw new Error("Você pode somente atualizar suas próprias questões");
    }

    if (typeof question.statement !== "string") {
        throw new Error("O enunciado é obrigatório");
    }

    const statement = question.statement.trim();

    if (!statement) {
        throw new Error("O enunciado é obrigatório");
    }

    const updatedQuestion = await updateQuestionRepository(id, { statement });

    await createLogService({
        userId: teacherId,
        action: "ALTERACAO_QUESTAO",
        description: `O usuário com o e-mail ${teacher.email} atualizou o enunciado da questão de ID ${id}, no quiz de ID ${existingQuestion.quizId}`
    });

    return updatedQuestion;
}

export async function deleteQuestionService(id: number, teacherId: number) {
    const teacher = await listUserByIdRepository(teacherId);

    if (!teacher) {
        throw new Error("Usuário não encontrado");
    }

    if (teacher.role !== UserRole.PROFESSOR) {
        throw new Error("Somente professores podem excluir questões");
    }

    const question = await listQuestionByIdService(id);
    const quiz = await listQuizByIdRepository(question.quizId);

    if (!quiz) {
        throw new Error("Quiz não encontrado");
    }

    const content = await listContentByIdRepository(quiz.contentId);

    if (!content) {
        throw new Error("Conteúdo não encontrado");
    }

    if (quiz.teacherId !== teacherId) {
        throw new Error("Você só pode excluir suas próprias questões");
    }

    await deleteQuestionRepository(id);

    await createLogService({
        userId: teacherId,
        action: "EXCLUSAO_QUESTAO",
        description: `O usuário com o e-mail ${teacher.email} excluiu a questão de ID ${id} do quiz de ID ${question.quizId}`
    });
}
