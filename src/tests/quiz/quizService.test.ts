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

const targetContent = { ...content, id: 2 };
const savedQuiz = { id: 5, contentId: content.id };
const input = { contentId: content.id };
const changes = { contentId: targetContent.id };
const updatedQuiz = { ...savedQuiz, ...changes };

beforeEach(() => {
    jest.resetAllMocks();
    listUserByIdMock.mockResolvedValue(teacher);
    listContentByIdMock.mockImplementation(async (id) => {
        if (id === content.id) return content;
        if (id === targetContent.id) return targetContent;
        return null;
    });
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

const mutations = [
    {
        name: "cadastro",
        execute: () => createQuizService(input, teacher.id),
        write: createQuizMock,
        roleError: "Somente professores podem criar quizzes"
    },
    {
        name: "atualização",
        execute: () => updateQuizService(savedQuiz.id, changes, teacher.id),
        write: updateQuizMock,
        roleError: "Somente professores podem atualizar quizzes"
    },
    {
        name: "exclusão",
        execute: () => deleteQuizService(savedQuiz.id, teacher.id),
        write: deleteQuizMock,
        roleError: "Somente professores podem excluir quizzes"
    }
];

describe.each(mutations)("Permissões e falhas no $name", ({ execute, write, roleError }) => {
    test("deve impedir a operação quando o usuário não existe", async () => {
        listUserByIdMock.mockResolvedValue(null);
        await expect(execute()).rejects.toThrow("Usuário não encontrado");
        expectNoWrites();
    });

    test.each([UserRole.ALUNO, UserRole.ADMIN])("deve impedir a operação para o perfil %s", async (role) => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role });
        await expect(execute()).rejects.toThrow(roleError);
        expectNoWrites();
    });

    test("deve impedir a operação em conteúdo de outro professor", async () => {
        listContentByIdMock.mockResolvedValue({ ...content, teacherId: 20 });
        await expect(execute()).rejects.toThrow(/seus próprios/);
        expectNoWrites();
    });

    test("deve impedir a operação quando o conteúdo não existe", async () => {
        listContentByIdMock.mockResolvedValue(null);
        await expect(execute()).rejects.toThrow("Conteúdo não encontrado");
        expectNoWrites();
    });

    test("deve propagar falhas na consulta sem alterar registros", async () => {
        const error = new Error("Falha ao consultar conteúdo");
        listContentByIdMock.mockRejectedValue(error);
        await expect(execute()).rejects.toBe(error);
        expectNoWrites();
    });

    test("não deve registrar sucesso se a gravação falhar", async () => {
        const error = new Error("Falha ao gravar quiz");
        write.mockRejectedValue(error);
        await expect(execute()).rejects.toBe(error);
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("deve propagar falhas no registro do log", async () => {
        const error = new Error("Log não foi registrado");
        createLogMock.mockRejectedValue(error);
        await expect(execute()).rejects.toBe(error);
        expect(write).toHaveBeenCalledTimes(1);
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
        listContentByIdMock.mockResolvedValueOnce(content)
            .mockResolvedValueOnce({ ...targetContent, teacherId: 20 });
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id))
            .rejects.toThrow("Você pode somente vincular quizzes aos seus próprios conteúdos");
        expectNoWrites();
    });

    test("deve impedir a troca para um conteúdo inexistente", async () => {
        listContentByIdMock.mockResolvedValueOnce(content).mockResolvedValueOnce(null);
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id))
            .rejects.toThrow("Conteúdo não encontrado");
        expectNoWrites();
    });

    test("deve impedir a troca para um conteúdo que possui outro quiz", async () => {
        listQuizByContentIdMock.mockResolvedValue({ id: 6, contentId: targetContent.id });
        await expect(updateQuizService(savedQuiz.id, changes, teacher.id))
            .rejects.toThrow("Este conteúdo já possui um quiz");
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
