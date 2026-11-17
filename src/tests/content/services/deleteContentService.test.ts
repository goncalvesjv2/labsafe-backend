import { listContentByIdMock, deleteContentMock, listUserByIdMock, createLogMock, teacher, savedContent } from "./helpers/contentServiceSetup";
import { describe, test, expect } from "@jest/globals";
import { deleteContentService } from "../../../services/contentService";
import { UserRole } from "../../../utils/user";

describe("deleteContentService", () => {
    test("deve permitir que o autor exclua o conteúdo e registrar o log", async () => {
        await expect(deleteContentService(savedContent.id, teacher.id)).resolves.toBeUndefined();
        expect(listUserByIdMock).toHaveBeenCalledWith(teacher.id);
        expect(listContentByIdMock).toHaveBeenCalledWith(savedContent.id);
        expect(deleteContentMock).toHaveBeenCalledTimes(1);
        expect(deleteContentMock).toHaveBeenCalledWith(savedContent.id, teacher.id);
        expect(createLogMock).toHaveBeenCalledTimes(1);
        expect(createLogMock).toHaveBeenCalledWith({
            userId: teacher.id,
            action: "EXCLUSAO_CONTEUDO",
            description: `O usuário com o e-mail ${teacher.email} excluiu o conteúdo de ID ${savedContent.id}`
        });
    });

    test("não deve excluir conteúdo quando o usuário não existe", async () => {
        listUserByIdMock.mockResolvedValue(null);
        await expect(deleteContentService(savedContent.id, teacher.id)).rejects.toThrow("Usuário não encontrado");
        expect(listContentByIdMock).not.toHaveBeenCalled();
        expect(deleteContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve permitir que um aluno exclua conteúdo", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ALUNO });
        await expect(deleteContentService(savedContent.id, teacher.id)).rejects.toThrow("Somente professores podem excluir conteúdos");
        expect(listContentByIdMock).not.toHaveBeenCalled();
        expect(deleteContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve permitir que um administrador exclua conteúdo", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ADMIN });
        await expect(deleteContentService(savedContent.id, teacher.id)).rejects.toThrow("Somente professores podem excluir conteúdos");
        expect(listContentByIdMock).not.toHaveBeenCalled();
        expect(deleteContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve excluir um conteúdo inexistente", async () => {
        listContentByIdMock.mockResolvedValue(null);
        await expect(deleteContentService(999, teacher.id)).rejects.toThrow("Conteúdo não encontrado");
        expect(deleteContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve permitir que um professor exclua conteúdo de outro professor", async () => {
        listContentByIdMock.mockResolvedValue({ ...savedContent, teacherId: 20 });
        await expect(deleteContentService(savedContent.id, teacher.id)).rejects.toThrow("Você só pode excluir seus próprios conteúdos");
        expect(deleteContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve excluir se a consulta do professor falhar", async () => {
        const error = new Error("Falha ao consultar usuário");
        listUserByIdMock.mockRejectedValue(error);
        await expect(deleteContentService(savedContent.id, teacher.id)).rejects.toBe(error);
        expect(deleteContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve excluir se a consulta do conteúdo falhar", async () => {
        const error = new Error("Falha ao consultar conteúdo");
        listContentByIdMock.mockRejectedValue(error);
        await expect(deleteContentService(savedContent.id, teacher.id)).rejects.toBe(error);
        expect(deleteContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve registrar sucesso quando a exclusão falhar", async () => {
        const error = new Error("Falha ao excluir conteúdo");
        deleteContentMock.mockRejectedValue(error);
        await expect(deleteContentService(savedContent.id, teacher.id)).rejects.toBe(error);
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("deve retornar erro se o registro do log falhar", async () => {
        const error = new Error("Log não foi registrado");
        createLogMock.mockRejectedValue(error);
        await expect(deleteContentService(savedContent.id, teacher.id)).rejects.toBe(error);
        expect(deleteContentMock).toHaveBeenCalledTimes(1);
    });
});
