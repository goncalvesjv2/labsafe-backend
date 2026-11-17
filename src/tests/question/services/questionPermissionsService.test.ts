import { listQuestionByIdMock, createQuestionMock, updateQuestionMock, deleteQuestionMock, listQuizByIdMock, listContentByIdMock, listUserByIdMock, createLogMock, teacher, content, quiz, input, savedQuestion, changes, expectNoWrites } from "./helpers/questionServiceSetup";
import { describe, expect, test } from "@jest/globals";
import { createQuestionService, deleteQuestionService, updateQuestionService } from "../../../services/questionService";
import { UserRole } from "../../../utils/user";

describe("Permissões e falhas comuns", () => {
    test("deve impedir alterações quando o usuário não existe", async () => {
        listUserByIdMock.mockResolvedValue(null);
        await expect(createQuestionService(input, teacher.id)).rejects.toThrow("Usuário não encontrado");
        await expect(updateQuestionService(savedQuestion.id, changes, teacher.id)).rejects.toThrow("Usuário não encontrado");
        await expect(deleteQuestionService(savedQuestion.id, teacher.id)).rejects.toThrow("Usuário não encontrado");
        expectNoWrites();
    });

    test("deve impedir alterações por alunos e administradores", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ALUNO });
        await expect(createQuestionService(input, teacher.id)).rejects.toThrow("Somente professores");
        await expect(updateQuestionService(savedQuestion.id, changes, teacher.id)).rejects.toThrow("Somente professores");
        await expect(deleteQuestionService(savedQuestion.id, teacher.id)).rejects.toThrow("Somente professores");
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ADMIN });
        await expect(createQuestionService(input, teacher.id)).rejects.toThrow("Somente professores");
        await expect(updateQuestionService(savedQuestion.id, changes, teacher.id)).rejects.toThrow("Somente professores");
        await expect(deleteQuestionService(savedQuestion.id, teacher.id)).rejects.toThrow("Somente professores");
        expectNoWrites();
    });

    test("deve impedir alterações nas questões de outro professor", async () => {
        // O conteúdo é do professor autenticado, mas o quiz foi criado por outro.
        listQuizByIdMock.mockResolvedValue({ ...quiz, teacherId: 20 });
        await expect(createQuestionService(input, teacher.id)).rejects.toThrow("seus próprios quizzes");
        await expect(updateQuestionService(savedQuestion.id, changes, teacher.id)).rejects.toThrow("suas próprias questões");
        await expect(deleteQuestionService(savedQuestion.id, teacher.id)).rejects.toThrow("suas próprias questões");
        expectNoWrites();
    });

    test("deve permitir que o criador do quiz altere suas questões mesmo se o professor do conteúdo mudar", async () => {
        listContentByIdMock.mockResolvedValue({ ...content, teacherId: 20 });

        await createQuestionService(input, teacher.id);
        await updateQuestionService(savedQuestion.id, changes, teacher.id);
        await deleteQuestionService(savedQuestion.id, teacher.id);

        expect(createQuestionMock).toHaveBeenCalledWith(input);
        expect(updateQuestionMock).toHaveBeenCalledWith(savedQuestion.id, changes);
        expect(deleteQuestionMock).toHaveBeenCalledWith(savedQuestion.id);
    });

    test("deve rejeitar alterações quando o quiz não existe", async () => {
        listQuizByIdMock.mockResolvedValue(null);
        await expect(createQuestionService(input, teacher.id)).rejects.toThrow("Quiz não encontrado");
        await expect(updateQuestionService(savedQuestion.id, changes, teacher.id)).rejects.toThrow("Quiz não encontrado");
        await expect(deleteQuestionService(savedQuestion.id, teacher.id)).rejects.toThrow("Quiz não encontrado");
        expectNoWrites();
    });

    test("deve rejeitar alterações quando o conteúdo não existe", async () => {
        listContentByIdMock.mockResolvedValue(null);
        await expect(createQuestionService(input, teacher.id)).rejects.toThrow("Conteúdo não encontrado");
        await expect(updateQuestionService(savedQuestion.id, changes, teacher.id)).rejects.toThrow("Conteúdo não encontrado");
        await expect(deleteQuestionService(savedQuestion.id, teacher.id)).rejects.toThrow("Conteúdo não encontrado");
        expectNoWrites();
    });

    test("deve rejeitar edição e exclusão de uma questão inexistente", async () => {
        listQuestionByIdMock.mockResolvedValue(null);
        await expect(updateQuestionService(999, changes, teacher.id)).rejects.toThrow("Questão não encontrada");
        await expect(deleteQuestionService(999, teacher.id)).rejects.toThrow("Questão não encontrada");
        expectNoWrites();
    });

    test("deve retornar falhas nas consultas sem gravar dados", async () => {
        const error = new Error("Falha na consulta");
        listContentByIdMock.mockRejectedValue(error);
        await expect(createQuestionService(input, teacher.id)).rejects.toBe(error);
        await expect(updateQuestionService(savedQuestion.id, changes, teacher.id)).rejects.toBe(error);
        await expect(deleteQuestionService(savedQuestion.id, teacher.id)).rejects.toBe(error);
        expectNoWrites();
    });

    test("não deve registrar sucesso quando a gravação falhar", async () => {
        const error = new Error("Falha ao gravar questão");
        createQuestionMock.mockRejectedValue(error);
        updateQuestionMock.mockRejectedValue(error);
        deleteQuestionMock.mockRejectedValue(error);
        await expect(createQuestionService(input, teacher.id)).rejects.toBe(error);
        await expect(updateQuestionService(savedQuestion.id, changes, teacher.id)).rejects.toBe(error);
        await expect(deleteQuestionService(savedQuestion.id, teacher.id)).rejects.toBe(error);
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("deve retornar falhas no registro do log", async () => {
        const error = new Error("Falha ao registrar log");
        createLogMock.mockRejectedValue(error);
        await expect(createQuestionService(input, teacher.id)).rejects.toBe(error);
        await expect(updateQuestionService(savedQuestion.id, changes, teacher.id)).rejects.toBe(error);
        await expect(deleteQuestionService(savedQuestion.id, teacher.id)).rejects.toBe(error);
        expect(createQuestionMock).toHaveBeenCalledTimes(1);
        expect(updateQuestionMock).toHaveBeenCalledTimes(1);
        expect(deleteQuestionMock).toHaveBeenCalledTimes(1);
    });
});
