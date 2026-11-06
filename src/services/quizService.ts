import { ICreateQuiz } from "../interfaces/IQuiz";
import { createQuizRepository, deleteQuizRepository, listQuizByContentIdRepository, listQuizByIdRepository, listQuizzesRepository, updateQuizRepository } from "../repositories/quizRepository";
import { listContentByIdRepository } from "../repositories/contentRepository";
import { listUserByIdRepository } from "../repositories/userRepository";
import { UserRole } from "../utils/user";
import { createLogService } from "./logService";

export async function listQuizzesService() {
    const quizzes = await listQuizzesRepository();
    return quizzes;
}

export async function listQuizByIdService(id: number) {
    const quiz = await listQuizByIdRepository(id);

    if (!quiz) {
        throw new Error("Quiz não encontrado");
    }

    return quiz;
}

export async function createQuizService(quiz: ICreateQuiz, teacherId: number) {
    const teacher = await listUserByIdRepository(teacherId);

    if (!teacher) {
        throw new Error("Usuário não encontrado");
    }

    if (teacher.role !== UserRole.PROFESSOR) {
        throw new Error("Somente professores podem criar quizzes");
    }

    const content = await listContentByIdRepository(quiz.contentId);

    if (!content) {
        throw new Error("Conteúdo não encontrado");
    }

    if (content.teacherId !== teacherId) {
        throw new Error("Você pode somente criar quizzes para seus próprios conteúdos");
    }

    const existQuiz = await listQuizByContentIdRepository(quiz.contentId);

    if (existQuiz) {
        throw new Error("Este conteúdo já possui um quiz");
    }

    const newQuiz = await createQuizRepository(quiz);

    await createLogService({
        userId: teacherId,
        action: "CADASTRO_QUIZ",
        description: `O usuário com o e-mail ${teacher.email} criou um quiz de ID ${newQuiz.id} para o conteúdo de ID ${newQuiz.contentId}`
    });

    return newQuiz;
}

export async function updateQuizService(id: number, quiz: ICreateQuiz, teacherId: number) {
    const teacher = await listUserByIdRepository(teacherId);

    if (!teacher) {
        throw new Error("Usuário não encontrado");
    }

    if (teacher.role !== UserRole.PROFESSOR) {
        throw new Error("Somente professores podem atualizar quizzes");
    }

    const existingQuiz = await listQuizByIdService(id);
    const currentContent = await listContentByIdRepository(existingQuiz.contentId);

    if (!currentContent) {
        throw new Error("Conteúdo não encontrado");
    }

    if (currentContent.teacherId !== teacherId) {
        throw new Error("Você pode somente atualizar seus próprios quizzes");
    }

    const targetContent = await listContentByIdRepository(quiz.contentId);

    if (!targetContent) {
        throw new Error("Conteúdo não encontrado");
    }

    if (targetContent.teacherId !== teacherId) {
        throw new Error("Você pode somente vincular quizzes aos seus próprios conteúdos");
    }

    const targetQuiz = await listQuizByContentIdRepository(quiz.contentId);

    if (targetQuiz && targetQuiz.id !== id) {
        throw new Error("Este conteúdo já possui um quiz");
    }

    const updateQuiz = await updateQuizRepository(id, quiz);

    await createLogService({
        userId: teacherId,
        action: "ALTERACAO_QUIZ",
        description: `O usuário com o e-mail ${teacher.email} atualizou o quiz de ID ${id}, do conteúdo de ID ${existingQuiz.contentId} para o conteúdo de ID ${updateQuiz.contentId}`
    });

    return updateQuiz;
}

export async function deleteQuizService(id: number, teacherId: number) {
    const teacher = await listUserByIdRepository(teacherId);

    if (!teacher) {
        throw new Error("Usuário não encontrado");
    }

    if (teacher.role !== UserRole.PROFESSOR) {
        throw new Error("Somente professores podem excluir quizzes");
    }

    const quiz = await listQuizByIdService(id);
    const content = await listContentByIdRepository(quiz.contentId);

    if (!content) {
        throw new Error("Conteúdo não encontrado");
    }

    if (content.teacherId !== teacherId) {
        throw new Error("Você só pode excluir seus próprios quizzes");
    }

    await deleteQuizRepository(id);

    await createLogService({
        userId: teacherId,
        action: "EXCLUSAO_QUIZ",
        description: `O usuário com o e-mail ${teacher.email} excluiu o quiz de ID ${id} do conteúdo de ID ${quiz.contentId}`
    });
}
