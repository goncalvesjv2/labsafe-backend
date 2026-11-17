import { listQuizByIdMock, createQuizMock, updateQuizMock, deleteQuizMock, listContentByIdMock, listUserByIdMock, createLogMock, teacher, content, savedQuiz, input, changes, expectNoWrites } from "./helpers/quizServiceSetup";
import { describe, test, expect } from "@jest/globals";
import { createQuizService, deleteQuizService, updateQuizService } from "../../../services/quizService";
import { UserRole } from "../../../utils/user";

describe("Regras comuns de cadastro, atualização e exclusão", () => {
    test("deve impedir a operação quando o usuário não existe", async () => {
        listUserByIdMock.mockResolvedValue(null);
        await expect(createQuizService(input, teacher.id)).rejects.toThrow("Usuário não encontrado");
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).rejects.toThrow("Usuário não encontrado");
        await expect(deleteQuizService(savedQuiz.id, teacher.id)).rejects.toThrow("Usuário não encontrado");
        expectNoWrites();
    });

    test("deve impedir que um aluno altere quizzes", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ALUNO });
        await expect(createQuizService(input, teacher.id)).rejects.toThrow("Somente professores podem criar quizzes");
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).rejects.toThrow("Somente professores podem atualizar quizzes");
        await expect(deleteQuizService(savedQuiz.id, teacher.id)).rejects.toThrow("Somente professores podem excluir quizzes");
        expectNoWrites();
    });

    test("deve impedir que um administrador altere quizzes", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ADMIN });
        await expect(createQuizService(input, teacher.id)).rejects.toThrow("Somente professores podem criar quizzes");
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).rejects.toThrow("Somente professores podem atualizar quizzes");
        await expect(deleteQuizService(savedQuiz.id, teacher.id)).rejects.toThrow("Somente professores podem excluir quizzes");
        expectNoWrites();
    });

    test("deve impedir a operação em conteúdo de outro professor", async () => {
        listContentByIdMock.mockResolvedValue({ ...content, teacherId: 20 });
        listQuizByIdMock.mockResolvedValue({ ...savedQuiz, teacherId: 20 });
        await expect(createQuizService(input, teacher.id)).rejects.toThrow("Você pode somente criar quizzes para seus próprios conteúdos");
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).rejects.toThrow("Você pode somente atualizar seus próprios quizzes");
        await expect(deleteQuizService(savedQuiz.id, teacher.id)).rejects.toThrow("Você só pode excluir seus próprios quizzes");
        expectNoWrites();
    });

    test("deve bloquear outro professor mesmo que ele seja o dono do conteúdo", async () => {
        listQuizByIdMock.mockResolvedValue({ ...savedQuiz, teacherId: 20 });

        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).rejects.toThrow("Você pode somente atualizar seus próprios quizzes");
        await expect(deleteQuizService(savedQuiz.id, teacher.id)).rejects.toThrow("Você só pode excluir seus próprios quizzes");
        expectNoWrites();
    });

    test("deve impedir a operação quando o conteúdo não existe", async () => {
        listContentByIdMock.mockResolvedValue(null);
        await expect(createQuizService(input, teacher.id)).rejects.toThrow("Conteúdo não encontrado");
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).rejects.toThrow("Conteúdo não encontrado");
        await expect(deleteQuizService(savedQuiz.id, teacher.id)).rejects.toThrow("Conteúdo não encontrado");
        expectNoWrites();
    });

    test("deve propagar falhas na consulta sem alterar registros", async () => {
        const error = new Error("Falha ao consultar conteúdo");
        listContentByIdMock.mockRejectedValue(error);
        await expect(createQuizService(input, teacher.id)).rejects.toBe(error);
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).rejects.toBe(error);
        await expect(deleteQuizService(savedQuiz.id, teacher.id)).rejects.toBe(error);
        expectNoWrites();
    });

    test("não deve registrar sucesso se a gravação falhar", async () => {
        const error = new Error("Falha ao gravar quiz");
        createQuizMock.mockRejectedValue(error);
        updateQuizMock.mockRejectedValue(error);
        deleteQuizMock.mockRejectedValue(error);
        await expect(createQuizService(input, teacher.id)).rejects.toBe(error);
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).rejects.toBe(error);
        await expect(deleteQuizService(savedQuiz.id, teacher.id)).rejects.toBe(error);
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("deve propagar falhas no registro do log", async () => {
        const error = new Error("Log não foi registrado");
        createLogMock.mockRejectedValue(error);
        await expect(createQuizService(input, teacher.id)).rejects.toBe(error);
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).rejects.toBe(error);
        await expect(deleteQuizService(savedQuiz.id, teacher.id)).rejects.toBe(error);
        expect(createQuizMock).toHaveBeenCalledTimes(1);
        expect(updateQuizMock).toHaveBeenCalledTimes(1);
        expect(deleteQuizMock).toHaveBeenCalledTimes(1);
    });
});
