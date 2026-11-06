/// <reference types="jest" />
import { describe, beforeEach, test, expect } from "@jest/globals";
import { createQuizService, deleteQuizService, listQuizByIdService, listQuizzesService, updateQuizService } from "../../services/quizService";
import { createQuizRepository, deleteQuizRepository, listQuizByContentIdRepository, listQuizByIdRepository, listQuizzesRepository, updateQuizRepository } from "../../repositories/quizRepository";
import { listContentByIdRepository } from "../../repositories/contentRepository";
import { listUserByIdRepository } from "../../repositories/userRepository";
import { createLogService } from "../../services/logService";
import { UserRole } from "../../utils/user";

jest.mock("../../repositories/quizRepository", () => ({
    listQuizzesRepository: jest.fn(),
    listQuizByIdRepository: jest.fn(),
    listQuizByContentIdRepository: jest.fn(),
    createQuizRepository: jest.fn(),
    updateQuizRepository: jest.fn(),
    deleteQuizRepository: jest.fn()
}));

jest.mock("../../repositories/contentRepository", () => ({
    listContentByIdRepository: jest.fn()
}));

jest.mock("../../repositories/userRepository", () => ({
    listUserByIdRepository: jest.fn()
}));

jest.mock("../../services/logService", () => ({
    createLogService: jest.fn()
}));

const listQuizzesMock = jest.mocked(listQuizzesRepository);
const listQuizByIdMock = jest.mocked(listQuizByIdRepository);
const listQuizByContentIdMock = jest.mocked(listQuizByContentIdRepository);
const createQuizMock = jest.mocked(createQuizRepository);
const updateQuizMock = jest.mocked(updateQuizRepository);
const deleteQuizMock = jest.mocked(deleteQuizRepository);
const listContentByIdMock = jest.mocked(listContentByIdRepository);
const listUserByIdMock = jest.mocked(listUserByIdRepository);
const createLogMock = jest.mocked(createLogService);

const teacher = {
    id: 10,
    name: "Ana",
    email: "ana@example.com",
    role: UserRole.PROFESSOR,
    ativo: true
};

const content = {
    id: 1,
    teacherId: teacher.id,
    title: "Segurança no laboratório",
    description: "Utilize os equipamentos de proteção."
};

const savedQuiz = { id: 5, contentId: content.id };
const input = { contentId: content.id };
const changes = { contentId: 2 };
const updatedQuiz = { ...savedQuiz, ...changes };

beforeEach(() => {
    jest.resetAllMocks();
    listUserByIdMock.mockResolvedValue(teacher);
    listContentByIdMock.mockResolvedValue(content);
    listQuizzesMock.mockResolvedValue([savedQuiz]);
    listQuizByIdMock.mockResolvedValue(savedQuiz);
    listQuizByContentIdMock.mockResolvedValue(null);
    createQuizMock.mockResolvedValue(savedQuiz);
    updateQuizMock.mockResolvedValue(updatedQuiz);
    deleteQuizMock.mockResolvedValue(undefined);
});

function expectNoWrites() {
    expect(createQuizMock).not.toHaveBeenCalled();
    expect(updateQuizMock).not.toHaveBeenCalled();
    expect(deleteQuizMock).not.toHaveBeenCalled();
    expect(createLogMock).not.toHaveBeenCalled();
}

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
        await expect(createQuizService(input, teacher.id)).rejects.toThrow("Você pode somente criar quizzes para seus próprios conteúdos");
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

describe("Consultas de quiz", () => {
    test("deve listar os quizzes", async () => {
        await expect(listQuizzesService()).resolves.toEqual([savedQuiz]);
    });

    test("deve retornar uma lista vazia quando não há quizzes", async () => {
        listQuizzesMock.mockResolvedValue([]);
        await expect(listQuizzesService()).resolves.toEqual([]);
    });

    test("deve buscar um quiz pelo ID", async () => {
        await expect(listQuizByIdService(savedQuiz.id)).resolves.toEqual(savedQuiz);
        expect(listQuizByIdMock).toHaveBeenCalledWith(savedQuiz.id);
    });

    test("deve informar quando o quiz não existe", async () => {
        listQuizByIdMock.mockResolvedValue(null);
        await expect(listQuizByIdService(999)).rejects.toThrow("Quiz não encontrado");
    });
});

describe("createQuizService", () => {
    test("deve criar o quiz para um conteúdo do professor e registrar o log", async () => {
        await expect(createQuizService(input, teacher.id)).resolves.toEqual(savedQuiz);
        expect(listUserByIdMock).toHaveBeenCalledWith(teacher.id);
        expect(listContentByIdMock).toHaveBeenCalledWith(input.contentId);
        expect(listQuizByContentIdMock).toHaveBeenCalledWith(input.contentId);
        expect(createQuizMock).toHaveBeenCalledWith(input);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: teacher.id,
            action: "CADASTRO_QUIZ",
            description: expect.stringContaining(teacher.email)
        }));
    });

    test("deve impedir um segundo quiz para o mesmo conteúdo", async () => {
        listQuizByContentIdMock.mockResolvedValue(savedQuiz);
        await expect(createQuizService(input, teacher.id)).rejects.toThrow("Este conteúdo já possui um quiz");
        expectNoWrites();
    });
});

describe("updateQuizService", () => {
    test("deve permitir trocar para outro conteúdo do mesmo professor", async () => {
        listContentByIdMock.mockResolvedValueOnce(content).mockResolvedValueOnce({ ...content, id: changes.contentId });
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).resolves.toEqual(updatedQuiz);
        expect(listQuizByIdMock).toHaveBeenCalledWith(savedQuiz.id);
        expect(listContentByIdMock).toHaveBeenCalledWith(savedQuiz.contentId);
        expect(listContentByIdMock).toHaveBeenCalledWith(changes.contentId);
        expect(listQuizByContentIdMock).toHaveBeenCalledWith(changes.contentId);
        expect(updateQuizMock).toHaveBeenCalledWith(savedQuiz.id, changes);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: teacher.id,
            action: "ALTERACAO_QUIZ"
        }));
    });

    test("deve permitir manter o conteúdo atual", async () => {
        listQuizByContentIdMock.mockResolvedValue(savedQuiz);
        updateQuizMock.mockResolvedValue(savedQuiz);
        await expect(updateQuizService(savedQuiz.id, input, teacher.id)).resolves.toEqual(savedQuiz);
        expect(updateQuizMock).toHaveBeenCalledWith(savedQuiz.id, input);
    });

    test("deve impedir vincular o quiz ao conteúdo de outro professor", async () => {
        listContentByIdMock.mockResolvedValueOnce(content).mockResolvedValueOnce({ ...content, id: changes.contentId, teacherId: 20 });
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).rejects.toThrow("Você pode somente vincular quizzes aos seus próprios conteúdos");
        expectNoWrites();
    });

    test("deve impedir a troca para um conteúdo inexistente", async () => {
        listContentByIdMock.mockResolvedValueOnce(content).mockResolvedValueOnce(null);
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).rejects.toThrow("Conteúdo não encontrado");
        expectNoWrites();
    });

    test("deve impedir a troca para um conteúdo que possui outro quiz", async () => {
        listContentByIdMock.mockResolvedValueOnce(content).mockResolvedValueOnce({ ...content, id: changes.contentId });
        listQuizByContentIdMock.mockResolvedValue({ id: 6, contentId: changes.contentId });
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id)).rejects.toThrow("Este conteúdo já possui um quiz");
        expectNoWrites();
    });

    test("deve impedir atualizar um quiz inexistente", async () => {
        listQuizByIdMock.mockResolvedValue(null);
        await expect(updateQuizService(999, changes, teacher.id)).rejects.toThrow("Quiz não encontrado");
        expectNoWrites();
    });
});

describe("deleteQuizService", () => {
    test("deve excluir o quiz do professor e registrar o log", async () => {
        await expect(deleteQuizService(savedQuiz.id, teacher.id)).resolves.toBeUndefined();
        expect(listQuizByIdMock).toHaveBeenCalledWith(savedQuiz.id);
        expect(listContentByIdMock).toHaveBeenCalledWith(savedQuiz.contentId);
        expect(deleteQuizMock).toHaveBeenCalledWith(savedQuiz.id);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: teacher.id,
            action: "EXCLUSAO_QUIZ"
        }));
    });

    test("deve impedir excluir um quiz inexistente", async () => {
        listQuizByIdMock.mockResolvedValue(null);
        await expect(deleteQuizService(999, teacher.id)).rejects.toThrow("Quiz não encontrado");
        expectNoWrites();
    });
});
