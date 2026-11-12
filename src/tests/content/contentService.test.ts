/// <reference types="jest" />
import { describe, beforeEach, test, expect } from "@jest/globals";
import { createContentService, deleteContentService, listContentByIdService, listContentsService, updateContentService } from "../../services/contentService";
import { createContentRepository, deleteContentRepository, listContentByIdRepository, listContentsRepository, updateContentRepository } from "../../repositories/contentRepository";
import { listUserByIdRepository } from "../../repositories/userRepository";
import { createLogService } from "../../services/logService";
import { UserRole } from "../../utils/user";

jest.mock("../../repositories/contentRepository", () => ({
    listContentsRepository: jest.fn(),
    listContentByIdRepository: jest.fn(),
    createContentRepository: jest.fn(),
    updateContentRepository: jest.fn(),
    deleteContentRepository: jest.fn()
}));

jest.mock("../../repositories/userRepository", () => ({
    listUserByIdRepository: jest.fn()
}));

jest.mock("../../services/logService", () => ({
    createLogService: jest.fn()
}));

const listContentsMock = jest.mocked(listContentsRepository);
const listContentByIdMock = jest.mocked(listContentByIdRepository);
const createContentMock = jest.mocked(createContentRepository);
const updateContentMock = jest.mocked(updateContentRepository);
const deleteContentMock = jest.mocked(deleteContentRepository);
const listUserByIdMock = jest.mocked(listUserByIdRepository);
const createLogMock = jest.mocked(createLogService);

const teacher = {
    id: 10,
    name: "Ana",
    email: "ana@example.com",
    role: UserRole.PROFESSOR,
    ativo: true
};

const input = {
    title: "Segurança no laboratório",
    description: "Utilize os equipamentos de proteção durante as atividades."
};

const savedContent = {
    id: 1,
    teacherId: teacher.id,
    ...input
};

beforeEach(() => {
    jest.resetAllMocks();
    listUserByIdMock.mockResolvedValue(teacher);
    listContentByIdMock.mockResolvedValue(savedContent);
    listContentsMock.mockResolvedValue([savedContent]);
    createContentMock.mockResolvedValue(savedContent);
    updateContentMock.mockResolvedValue(savedContent);
    deleteContentMock.mockResolvedValue(undefined);
});

describe("listContentsService", () => {
    test("deve retornar os conteúdos cadastrados", async () => {
        const otherContent = { ...savedContent, id: 2, teacherId: 20 };
        listContentsMock.mockResolvedValue([savedContent, otherContent]);
        const result = await listContentsService();
        expect(result).toEqual([savedContent, otherContent]);
        expect(listContentsMock).toHaveBeenCalledTimes(1);
    });

    test("deve retornar uma lista vazia quando não existem conteúdos", async () => {
        listContentsMock.mockResolvedValue([]);
        await expect(listContentsService()).resolves.toEqual([]);
    });

    test("deve retornar erro quando a consulta falhar", async () => {
        const error = new Error("Falha ao consultar conteúdos");
        listContentsMock.mockRejectedValue(error);
        await expect(listContentsService()).rejects.toBe(error);
    });
});

describe("listContentByIdService", () => {
    test("deve retornar o conteúdo encontrado pelo ID", async () => {
        const result = await listContentByIdService(savedContent.id);
        expect(result).toEqual(savedContent);
        expect(listContentByIdMock).toHaveBeenCalledTimes(1);
        expect(listContentByIdMock).toHaveBeenCalledWith(savedContent.id);
    });

    test("deve informar quando o conteúdo não existe", async () => {
        listContentByIdMock.mockResolvedValue(null);
        await expect(listContentByIdService(999)).rejects.toThrow("Conteúdo não encontrado");
    });

    test("deve retornar erro quando a consulta falhar", async () => {
        const error = new Error("Falha ao consultar conteúdo");
        listContentByIdMock.mockRejectedValue(error);
        await expect(listContentByIdService(savedContent.id)).rejects.toBe(error);
    });
});

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