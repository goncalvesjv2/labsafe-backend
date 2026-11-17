import { listAlternativesMock, listAlternativeByIdMock, listAlternativesByQuestionIdMock, listQuestionByIdMock, listUserByIdMock, teacher, question, incorrectAlternative, savedAlternatives, studentAlternatives } from "./helpers/alternativeServiceSetup";
import { describe, expect, test } from "@jest/globals";
import { listAlternativeByIdService, listAlternativesByQuestionIdService, listAlternativesService } from "../../../services/alternativeService";
import { UserRole } from "../../../utils/user";

describe("Consultas de alternativas", () => {
    test("deve listar todas as alternativas com correct para o professor", async () => {
        const result = await listAlternativesService(teacher.id);
        expect(result).toEqual(savedAlternatives);
    });

    test("deve buscar uma alternativa pelo ID para o professor", async () => {
        const result = await listAlternativeByIdService(incorrectAlternative.id, teacher.id);
        expect(result).toEqual(incorrectAlternative);
        expect(listAlternativeByIdMock).toHaveBeenCalledWith(incorrectAlternative.id);
    });

    test("deve listar as alternativas de uma questão para o professor", async () => {
        const result = await listAlternativesByQuestionIdService(question.id, teacher.id);
        expect(result).toEqual(savedAlternatives);
        expect(listAlternativesByQuestionIdMock).toHaveBeenCalledWith(question.id);
    });

    test("deve permitir uma listagem vazia", async () => {
        listAlternativesMock.mockResolvedValue([]);
        listAlternativesByQuestionIdMock.mockResolvedValue([]);
        await expect(listAlternativesService(teacher.id)).resolves.toEqual([]);
        await expect(listAlternativesByQuestionIdService(question.id, teacher.id)).resolves.toEqual([]);
    });

    test("deve esconder correct do aluno na listagem geral", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ALUNO });
        const result = await listAlternativesService(teacher.id);
        expect(result).toEqual(studentAlternatives);
    });

    test("deve esconder correct do aluno na busca pelo ID", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ALUNO });
        const result = await listAlternativeByIdService(incorrectAlternative.id, teacher.id);
        expect(result).toEqual(studentAlternatives[1]);
    });

    test("deve esconder correct do aluno na listagem por questão", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ALUNO });
        const result = await listAlternativesByQuestionIdService(question.id, teacher.id);
        expect(result).toEqual(studentAlternatives);
    });

    test("deve impedir consultas quando o usuário não existe", async () => {
        listUserByIdMock.mockResolvedValue(null);
        await expect(listAlternativesService(teacher.id)).rejects.toThrow("Usuário não encontrado");
        await expect(listAlternativeByIdService(1, teacher.id)).rejects.toThrow("Usuário não encontrado");
        await expect(listAlternativesByQuestionIdService(question.id, teacher.id)).rejects.toThrow("Usuário não encontrado");
        expect(listAlternativesMock).not.toHaveBeenCalled();
        expect(listAlternativeByIdMock).not.toHaveBeenCalled();
        expect(listAlternativesByQuestionIdMock).not.toHaveBeenCalled();
    });

    test("deve impedir consultas de administradores", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ADMIN });
        await expect(listAlternativesService(teacher.id)).rejects.toThrow("Somente professores e alunos");
        await expect(listAlternativeByIdService(1, teacher.id)).rejects.toThrow("Somente professores e alunos");
        await expect(listAlternativesByQuestionIdService(question.id, teacher.id)).rejects.toThrow("Somente professores e alunos");
        expect(listAlternativesMock).not.toHaveBeenCalled();
        expect(listAlternativeByIdMock).not.toHaveBeenCalled();
        expect(listAlternativesByQuestionIdMock).not.toHaveBeenCalled();
    });

    test("deve informar quando a alternativa não existe", async () => {
        listAlternativeByIdMock.mockResolvedValue(null);
        await expect(listAlternativeByIdService(999, teacher.id)).rejects.toThrow("Alternativa não encontrada");
    });

    test("deve impedir a listagem de uma questão inexistente", async () => {
        listQuestionByIdMock.mockResolvedValue(null);
        await expect(listAlternativesByQuestionIdService(999, teacher.id)).rejects.toThrow("Questão não encontrada");
        expect(listAlternativesByQuestionIdMock).not.toHaveBeenCalled();
    });
});
