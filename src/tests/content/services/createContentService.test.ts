import { createContentMock, listUserByIdMock, createLogMock, teacher, input, savedContent } from "./helpers/contentServiceSetup";
import { describe, test, expect } from "@jest/globals";
import { createContentService } from "../../../services/contentService";
import { UserRole } from "../../../utils/user";

describe("createContentService", () => {
    test("deve criar o conteúdo vinculado ao professor e registrar o log", async () => {
        const result = await createContentService(input, teacher.id);
        expect(result).toEqual(savedContent);
        expect(listUserByIdMock).toHaveBeenCalledWith(teacher.id);
        expect(createContentMock).toHaveBeenCalledTimes(1);
        expect(createContentMock).toHaveBeenCalledWith(input, teacher.id);
        expect(createLogMock).toHaveBeenCalledTimes(1);
        expect(createLogMock).toHaveBeenCalledWith({
            userId: teacher.id,
            action: "CADASTRO_CONTEUDO",
            description: `O usuário com o e-mail ${teacher.email} criou um conteúdo de ID ${savedContent.id}`
        });
    });

    test("deve aceitar uma descrição longa sem limitar o texto", async () => {
        const longContent = { ...input, description: "a".repeat(20000) };
        createContentMock.mockResolvedValue({ ...savedContent, ...longContent });
        const result = await createContentService(longContent, teacher.id);
        expect(result.description).toBe(longContent.description);
        expect(createContentMock).toHaveBeenCalledWith(longContent, teacher.id);
    });

    test("não deve criar conteúdo quando o usuário não existe", async () => {
        listUserByIdMock.mockResolvedValue(null);
        await expect(createContentService(input, teacher.id)).rejects.toThrow("Usuário não encontrado");
        expect(createContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve permitir que um aluno crie conteúdo", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ALUNO });
        await expect(createContentService(input, teacher.id)).rejects.toThrow("Somente professores podem criar conteúdos");
        expect(createContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve permitir que um administrador crie conteúdo", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ADMIN });
        await expect(createContentService(input, teacher.id)).rejects.toThrow("Somente professores podem criar conteúdos");
        expect(createContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve criar conteúdo se a consulta do professor falhar", async () => {
        const error = new Error("Falha ao consultar usuário");
        listUserByIdMock.mockRejectedValue(error);
        await expect(createContentService(input, teacher.id)).rejects.toBe(error);
        expect(createContentMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve registrar sucesso quando a criação falhar", async () => {
        const error = new Error("Falha ao criar conteúdo");
        createContentMock.mockRejectedValue(error);
        await expect(createContentService(input, teacher.id)).rejects.toBe(error);
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("deve retornar erro se o registro do log falhar", async () => {
        const error = new Error("Log não foi registrado");
        createLogMock.mockRejectedValue(error);
        await expect(createContentService(input, teacher.id)).rejects.toBe(error);
        expect(createContentMock).toHaveBeenCalledTimes(1);
    });
});
