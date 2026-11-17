import { listContentByIdMock, updateContentMock, listUserByIdMock, createLogMock, teacher, input, savedContent } from "./helpers/contentServiceSetup";
import { describe, test, expect } from "@jest/globals";
import { updateContentService } from "../../../services/contentService";
import { UserRole } from "../../../utils/user";

describe("updateContentService", () => {
    test("deve permitir que o autor atualize o título e a descrição", async () => {
        const changes = { title: "Novo título", description: "Nova descrição" };
        const updatedContent = { ...savedContent, ...changes };
        updateContentMock.mockResolvedValue(updatedContent);
        const result = await updateContentService(savedContent.id, changes, teacher.id);
        expect(result).toEqual(updatedContent);
        expect(listUserByIdMock).toHaveBeenCalledWith(teacher.id);
        expect(listContentByIdMock).toHaveBeenCalledWith(savedContent.id);
        expect(updateContentMock).toHaveBeenCalledTimes(1);
        expect(updateContentMock).toHaveBeenCalledWith(savedContent.id, changes, teacher.id);
        expect(createLogMock).toHaveBeenCalledTimes(1);
        expect(createLogMock).toHaveBeenCalledWith({
            userId: teacher.id,
            action: "ALTERACAO_CONTEUDO",
            description: `O usuário com o e-mail ${teacher.email} atualizou o conteúdo de ID ${savedContent.id}`
        });
    });

    test("deve permitir atualizar somente o título", async () => {
        const changes = { title: "Novo título" };
        const updatedContent = { ...savedContent, ...changes };
        updateContentMock.mockResolvedValue(updatedContent);
        const result = await updateContentService(savedContent.id, changes, teacher.id);
        expect(result).toEqual(updatedContent);
        expect(listUserByIdMock).toHaveBeenCalledWith(teacher.id);
        expect(listContentByIdMock).toHaveBeenCalledWith(savedContent.id);
        expect(updateContentMock).toHaveBeenCalledTimes(1);
        expect(updateContentMock).toHaveBeenCalledWith(savedContent.id, changes, teacher.id);
        expect(createLogMock).toHaveBeenCalledTimes(1);
        expect(createLogMock).toHaveBeenCalledWith({
            userId: teacher.id,
            action: "ALTERACAO_CONTEUDO",
            description: `O usuário com o e-mail ${teacher.email} atualizou o conteúdo de ID ${savedContent.id}`
        });
    });

    test("deve permitir atualizar somente a descrição", async () => {
        const changes = { description: "Nova descrição" };
        const updatedContent = { ...savedContent, ...changes };
        updateContentMock.mockResolvedValue(updatedContent);
        const result = await updateContentService(savedContent.id, changes, teacher.id);
        expect(result).toEqual(updatedContent);
        expect(listUserByIdMock).toHaveBeenCalledWith(teacher.id);
        expect(listContentByIdMock).toHaveBeenCalledWith(savedContent.id);
        expect(updateContentMock).toHaveBeenCalledTimes(1);
        expect(updateContentMock).toHaveBeenCalledWith(savedContent.id, changes, teacher.id);
        expect(createLogMock).toHaveBeenCalledTimes(1);
        expect(createLogMock).toHaveBeenCalledWith({
            userId: teacher.id,
            action: "ALTERACAO_CONTEUDO",
            description: `O usuário com o e-mail ${teacher.email} atualizou o conteúdo de ID ${savedContent.id}`
        });
    });

    test("não deve atualizar conteúdo quando o usuário não existe", async () => {
        listUserByIdMock.mockResolvedValue(null);
        await expect(updateContentService(savedContent.id, input, teacher.id)).rejects.toThrow("Usuário não encontrado");
        expect(listContentByIdMock).not.toHaveBeenCalled();
        expect(updateContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve permitir que um aluno atualize conteúdo", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ALUNO });
        await expect(updateContentService(savedContent.id, input, teacher.id)).rejects.toThrow("Somente professores podem atualizar conteúdos");
        expect(listContentByIdMock).not.toHaveBeenCalled();
        expect(updateContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve permitir que um administrador atualize conteúdo", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ADMIN });
        await expect(updateContentService(savedContent.id, input, teacher.id)).rejects.toThrow("Somente professores podem atualizar conteúdos");
        expect(listContentByIdMock).not.toHaveBeenCalled();
        expect(updateContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve atualizar um conteúdo inexistente", async () => {
        listContentByIdMock.mockResolvedValue(null);
        await expect(updateContentService(999, input, teacher.id)).rejects.toThrow("Conteúdo não encontrado");
        expect(updateContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve permitir que um professor atualize conteúdo de outro professor", async () => {
        listContentByIdMock.mockResolvedValue({ ...savedContent, teacherId: 20 });
        await expect(updateContentService(savedContent.id, input, teacher.id)).rejects.toThrow("Você pode somente atualizar seus próprios conteúdos");
        expect(updateContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve atualizar quando nenhum campo foi informado", async () => {
        await expect(updateContentService(savedContent.id, {}, teacher.id)).rejects.toThrow("Informe ao menos um campo para atualizar");
        expect(updateContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve atualizar se a consulta do professor falhar", async () => {
        const error = new Error("Falha ao consultar usuário");
        listUserByIdMock.mockRejectedValue(error);
        await expect(updateContentService(savedContent.id, input, teacher.id)).rejects.toBe(error);
        expect(updateContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve atualizar se a consulta do conteúdo falhar", async () => {
        const error = new Error("Falha ao consultar conteúdo");
        listContentByIdMock.mockRejectedValue(error);
        await expect(updateContentService(savedContent.id, input, teacher.id)).rejects.toBe(error);
        expect(updateContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve registrar sucesso quando a atualização falhar", async () => {
        const error = new Error("Falha ao atualizar conteúdo");
        updateContentMock.mockRejectedValue(error);
        await expect(updateContentService(savedContent.id, input, teacher.id)).rejects.toBe(error);
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("deve retornar erro se o registro do log falhar", async () => {
        const error = new Error("Log não foi registrado");
        createLogMock.mockRejectedValue(error);
        await expect(updateContentService(savedContent.id, input, teacher.id)).rejects.toBe(error);
        expect(updateContentMock).toHaveBeenCalledTimes(1);
    });
});
