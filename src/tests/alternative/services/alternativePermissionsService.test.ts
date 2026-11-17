import { listAlternativeByIdMock, listAlternativesByQuestionIdMock, countAlternativesMock, createAlternativeMock, updateAlternativeMock, changeCorrectMock, deleteAlternativeMock, listQuestionByIdMock, listQuizByIdMock, listUserByIdMock, createLogMock, teacher, quiz, input, thirdAlternative, savedAlternatives, expectNoWrites } from "./helpers/alternativeServiceSetup";
import { describe, expect, test } from "@jest/globals";
import { changeCorrectService, createAlternativeService, deleteAlternativeService, updateAlternativeService } from "../../../services/alternativeService";
import { UserRole } from "../../../utils/user";

describe("Permissões e falhas comuns nas alterações", () => {
    test("deve impedir alterações quando o usuário não existe", async () => {
        listUserByIdMock.mockResolvedValue(null);
        await expect(createAlternativeService(input, teacher.id)).rejects.toThrow("Usuário não encontrado");
        await expect(updateAlternativeService(2, { text: "Luvas" }, teacher.id)).rejects.toThrow("Usuário não encontrado");
        await expect(changeCorrectService(2, teacher.id)).rejects.toThrow("Usuário não encontrado");
        await expect(deleteAlternativeService(2, teacher.id)).rejects.toThrow("Usuário não encontrado");
        expectNoWrites();
    });

    test("deve impedir alterações por alunos", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ALUNO });
        await expect(createAlternativeService(input, teacher.id)).rejects.toThrow("Somente professores");
        await expect(updateAlternativeService(2, { text: "Luvas" }, teacher.id)).rejects.toThrow("Somente professores");
        await expect(changeCorrectService(2, teacher.id)).rejects.toThrow("Somente professores");
        await expect(deleteAlternativeService(2, teacher.id)).rejects.toThrow("Somente professores");
        expectNoWrites();
    });

    test("deve impedir alterações por administradores", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ADMIN });
        await expect(createAlternativeService(input, teacher.id)).rejects.toThrow("Somente professores");
        await expect(updateAlternativeService(2, { text: "Luvas" }, teacher.id)).rejects.toThrow("Somente professores");
        await expect(changeCorrectService(2, teacher.id)).rejects.toThrow("Somente professores");
        await expect(deleteAlternativeService(2, teacher.id)).rejects.toThrow("Somente professores");
        expectNoWrites();
    });

    test("deve impedir alterações no quiz de outro professor", async () => {
        listQuizByIdMock.mockResolvedValue({ ...quiz, teacherId: 20 });
        await expect(createAlternativeService(input, teacher.id)).rejects.toThrow("seus próprios quizzes");
        await expect(updateAlternativeService(2, { text: "Luvas" }, teacher.id)).rejects.toThrow("seus próprios quizzes");
        await expect(changeCorrectService(2, teacher.id)).rejects.toThrow("seus próprios quizzes");
        await expect(deleteAlternativeService(2, teacher.id)).rejects.toThrow("seus próprios quizzes");
        expectNoWrites();
    });

    test("deve impedir alterações quando a alternativa não existe", async () => {
        listAlternativeByIdMock.mockResolvedValue(null);
        await expect(updateAlternativeService(999, { text: "Luvas" }, teacher.id)).rejects.toThrow("Alternativa não encontrada");
        await expect(changeCorrectService(999, teacher.id)).rejects.toThrow("Alternativa não encontrada");
        await expect(deleteAlternativeService(999, teacher.id)).rejects.toThrow("Alternativa não encontrada");
        expectNoWrites();
    });

    test("deve impedir alterações quando a questão não existe", async () => {
        listQuestionByIdMock.mockResolvedValue(null);
        await expect(createAlternativeService(input, teacher.id)).rejects.toThrow("Questão não encontrada");
        await expect(updateAlternativeService(2, { text: "Luvas" }, teacher.id)).rejects.toThrow("Questão não encontrada");
        await expect(changeCorrectService(2, teacher.id)).rejects.toThrow("Questão não encontrada");
        await expect(deleteAlternativeService(2, teacher.id)).rejects.toThrow("Questão não encontrada");
        expectNoWrites();
    });

    test("deve impedir alterações quando o quiz não existe", async () => {
        listQuizByIdMock.mockResolvedValue(null);
        await expect(createAlternativeService(input, teacher.id)).rejects.toThrow("Quiz não encontrado");
        await expect(updateAlternativeService(2, { text: "Luvas" }, teacher.id)).rejects.toThrow("Quiz não encontrado");
        await expect(changeCorrectService(2, teacher.id)).rejects.toThrow("Quiz não encontrado");
        await expect(deleteAlternativeService(2, teacher.id)).rejects.toThrow("Quiz não encontrado");
        expectNoWrites();
    });

    test("não deve registrar sucesso quando a gravação falha", async () => {
        const error = new Error("Falha ao gravar alternativa");
        countAlternativesMock.mockResolvedValue(3);
        listAlternativesByQuestionIdMock.mockResolvedValue([...savedAlternatives, thirdAlternative]);
        createAlternativeMock.mockRejectedValue(error);
        updateAlternativeMock.mockRejectedValue(error);
        changeCorrectMock.mockRejectedValue(error);
        deleteAlternativeMock.mockRejectedValue(error);
        await expect(createAlternativeService([input[1]], teacher.id)).rejects.toThrow(error);
        await expect(updateAlternativeService(2, { text: "Luvas" }, teacher.id)).rejects.toThrow(error);
        await expect(changeCorrectService(2, teacher.id)).rejects.toThrow(error);
        await expect(deleteAlternativeService(2, teacher.id)).rejects.toThrow(error);
        expect(createLogMock).not.toHaveBeenCalled();
    });
});
