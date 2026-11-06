/// <reference types="jest" />
import { beforeEach, describe, expect, test } from "@jest/globals";
import { createQuestionService, deleteQuestionService, listQuestionByIdService, listQuestionsByQuizIdService, listQuestionsService, updateQuestionService } from "../../services/questionService";
import { countQuestionsByQuizIdRepository, createQuestionRepository, deleteQuestionRepository, listQuestionByIdRepository, listQuestionsByQuizIdRepository, listQuestionsRepository, updateQuestionRepository } from "../../repositories/questionRepository";
import { listQuizByIdRepository } from "../../repositories/quizRepository";
import { listContentByIdRepository } from "../../repositories/contentRepository";
import { listUserByIdRepository } from "../../repositories/userRepository";
import { createLogService } from "../../services/logService";
import { UserRole } from "../../utils/user";

jest.mock("../../repositories/questionRepository", () => ({
    listQuestionsRepository: jest.fn(),
    listQuestionByIdRepository: jest.fn(),
    listQuestionsByQuizIdRepository: jest.fn(),
    countQuestionsByQuizIdRepository: jest.fn(),
    createQuestionRepository: jest.fn(),
    updateQuestionRepository: jest.fn(),
    deleteQuestionRepository: jest.fn()
}));
jest.mock("../../repositories/quizRepository", () => ({ listQuizByIdRepository: jest.fn() }));
jest.mock("../../repositories/contentRepository", () => ({ listContentByIdRepository: jest.fn() }));
jest.mock("../../repositories/userRepository", () => ({ listUserByIdRepository: jest.fn() }));
jest.mock("../../services/logService", () => ({ createLogService: jest.fn() }));

const listQuestionsMock = jest.mocked(listQuestionsRepository);
const listQuestionByIdMock = jest.mocked(listQuestionByIdRepository);
const listQuestionsByQuizIdMock = jest.mocked(listQuestionsByQuizIdRepository);
const countQuestionsMock = jest.mocked(countQuestionsByQuizIdRepository);
const createQuestionMock = jest.mocked(createQuestionRepository);
const updateQuestionMock = jest.mocked(updateQuestionRepository);
const deleteQuestionMock = jest.mocked(deleteQuestionRepository);
const listQuizByIdMock = jest.mocked(listQuizByIdRepository);
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
    title: "Segurança",
    description: "Orientações de segurança."
};
const targetContent = {
    id: 2,
    teacherId: teacher.id,
    title: "Equipamentos",
    description: "Equipamentos de proteção."
};
const quiz = { id: 5, contentId: content.id, teacherId: teacher.id };
const targetQuiz = { id: 6, contentId: targetContent.id, teacherId: teacher.id };
const input = { quizId: quiz.id, statement: "Quando utilizar luvas?" };
const savedQuestion = { id: 8, quizId: quiz.id, statement: "Quando utilizar luvas?" };
const changes = { statement: "Quando utilizar óculos de proteção?" };
const updatedQuestion = { id: 8, quizId: quiz.id, statement: changes.statement };

beforeEach(() => {
    jest.resetAllMocks();
    listUserByIdMock.mockResolvedValue(teacher);
    listQuizByIdMock.mockResolvedValue(quiz);
    listContentByIdMock.mockResolvedValue(content);
    listQuestionsMock.mockResolvedValue([savedQuestion]);
    listQuestionByIdMock.mockResolvedValue(savedQuestion);
    listQuestionsByQuizIdMock.mockResolvedValue([savedQuestion]);
    countQuestionsMock.mockResolvedValue(2);
    createQuestionMock.mockResolvedValue(savedQuestion);
    updateQuestionMock.mockResolvedValue(updatedQuestion);
    deleteQuestionMock.mockResolvedValue(undefined);
});

function expectNoWrites() {
    expect(createQuestionMock).not.toHaveBeenCalled();
    expect(updateQuestionMock).not.toHaveBeenCalled();
    expect(deleteQuestionMock).not.toHaveBeenCalled();
    expect(createLogMock).not.toHaveBeenCalled();
}

describe("Consultas de questões", () => {
    test("deve listar todas as questões", async () => {
        const result = await listQuestionsService();
        expect(result).toEqual([savedQuestion]);
    });

    test("deve permitir uma listagem geral vazia", async () => {
        listQuestionsMock.mockResolvedValue([]);
        const result = await listQuestionsService();
        expect(result).toEqual([]);
    });

    test("deve buscar uma questão pelo ID", async () => {
        const result = await listQuestionByIdService(savedQuestion.id);
        expect(result).toEqual(savedQuestion);
        expect(listQuestionByIdMock).toHaveBeenCalledWith(savedQuestion.id);
    });

    test("deve informar quando a questão não existe", async () => {
        listQuestionByIdMock.mockResolvedValue(null);
        await expect(listQuestionByIdService(999)).rejects.toThrow("Questão não encontrada");
    });

    test("deve listar as questões de um quiz existente", async () => {
        const result = await listQuestionsByQuizIdService(quiz.id);
        expect(result).toEqual([savedQuestion]);
        expect(listQuestionsByQuizIdMock).toHaveBeenCalledWith(quiz.id);
    });

    test("deve permitir um quiz existente sem questões", async () => {
        listQuestionsByQuizIdMock.mockResolvedValue([]);
        const result = await listQuestionsByQuizIdService(quiz.id);
        expect(result).toEqual([]);
    });

    test("deve rejeitar a listagem por um quiz inexistente", async () => {
        listQuizByIdMock.mockResolvedValue(null);
        await expect(listQuestionsByQuizIdService(999)).rejects.toThrow("Quiz não encontrado");
        expect(listQuestionsByQuizIdMock).not.toHaveBeenCalled();
    });
});

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
        await expect(updateQuestionService(savedQuestion.id, { quizId: targetQuiz.id }, teacher.id)).rejects.toThrow("suas próprias questões");
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

describe("Cadastro de questões", () => {
    test("deve permitir cadastrar a primeira questão, normalizar o enunciado e registrar o log", async () => {
        countQuestionsMock.mockResolvedValue(0);
        const data = { quizId: quiz.id, statement: "  Quando utilizar luvas?  " };
        const result = await createQuestionService(data, teacher.id);
        expect(result).toEqual(savedQuestion);
        expect(createQuestionMock).toHaveBeenCalledWith(input);
        expect(countQuestionsMock).toHaveBeenCalledWith(quiz.id);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({ userId: teacher.id, action: "CADASTRO_QUESTAO" }));
    });

    test("deve permitir cadastrar a décima questão", async () => {
        countQuestionsMock.mockResolvedValue(9);
        const result = await createQuestionService(input, teacher.id);
        expect(result).toEqual(savedQuestion);
        expect(createQuestionMock).toHaveBeenCalledTimes(1);
    });

    test("deve impedir o cadastro quando já existem dez ou mais questões", async () => {
        countQuestionsMock.mockResolvedValue(10);
        await expect(createQuestionService(input, teacher.id)).rejects.toThrow("O quiz pode ter no máximo 10 questões");
        countQuestionsMock.mockResolvedValue(11);
        await expect(createQuestionService(input, teacher.id)).rejects.toThrow("O quiz pode ter no máximo 10 questões");
        expectNoWrites();
    });

    test("deve rejeitar enunciados vazios ou formados por espaços", async () => {
        const emptyStatement = { quizId: quiz.id, statement: "" };
        const spacesOnly = { quizId: quiz.id, statement: "  \t\n " };
        await expect(createQuestionService(emptyStatement, teacher.id)).rejects.toThrow("O enunciado é obrigatório");
        await expect(createQuestionService(spacesOnly, teacher.id)).rejects.toThrow("O enunciado é obrigatório");
        expectNoWrites();
    });
});

describe("Atualização de questões", () => {
    test("deve atualizar somente o enunciado e registrar o log", async () => {
        const data = { statement: "  Quando utilizar óculos de proteção?  " };
        const result = await updateQuestionService(savedQuestion.id, data, teacher.id);
        expect(result).toEqual(updatedQuestion);
        expect(updateQuestionMock).toHaveBeenCalledWith(savedQuestion.id, changes);
        expect(countQuestionsMock).not.toHaveBeenCalled();
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({ userId: teacher.id, action: "ALTERACAO_QUESTAO" }));
    });

    test("deve permitir manter o quiz atual mesmo quando ele possui dez questões", async () => {
        countQuestionsMock.mockResolvedValue(10);
        const data = { quizId: quiz.id, statement: changes.statement };
        const result = await updateQuestionService(savedQuestion.id, data, teacher.id);
        expect(result).toEqual(updatedQuestion);
        expect(countQuestionsMock).not.toHaveBeenCalled();
    });

    test("deve permitir mover a questão para outro quiz próprio com nove questões", async () => {
        listQuizByIdMock.mockResolvedValueOnce(quiz);
        listQuizByIdMock.mockResolvedValueOnce(targetQuiz);
        listContentByIdMock.mockResolvedValueOnce(content);
        listContentByIdMock.mockResolvedValueOnce(targetContent);
        countQuestionsMock.mockResolvedValue(9);
        const movedQuestion = { id: savedQuestion.id, quizId: targetQuiz.id, statement: input.statement };
        updateQuestionMock.mockResolvedValue(movedQuestion);
        const result = await updateQuestionService(savedQuestion.id, { quizId: targetQuiz.id }, teacher.id);
        expect(result).toEqual(movedQuestion);
        expect(countQuestionsMock).toHaveBeenCalledWith(targetQuiz.id);
        expect(updateQuestionMock).toHaveBeenCalledWith(savedQuestion.id, { quizId: targetQuiz.id });
    });

    test("deve impedir mover a questão para um quiz que já possui dez questões", async () => {
        listQuizByIdMock.mockResolvedValueOnce(quiz);
        listQuizByIdMock.mockResolvedValueOnce(targetQuiz);
        listContentByIdMock.mockResolvedValueOnce(content);
        listContentByIdMock.mockResolvedValueOnce(targetContent);
        countQuestionsMock.mockResolvedValue(10);
        await expect(updateQuestionService(savedQuestion.id, { quizId: targetQuiz.id }, teacher.id)).rejects.toThrow("O quiz pode ter no máximo 10 questões");
        expectNoWrites();
    });

    test("deve impedir a troca para um quiz inexistente", async () => {
        listQuizByIdMock.mockResolvedValueOnce(quiz);
        listQuizByIdMock.mockResolvedValueOnce(null);
        await expect(updateQuestionService(savedQuestion.id, { quizId: 999 }, teacher.id)).rejects.toThrow("Quiz não encontrado");
        expectNoWrites();
    });

    test("deve impedir a troca quando o conteúdo de destino não existe", async () => {
        listQuizByIdMock.mockResolvedValueOnce(quiz);
        listQuizByIdMock.mockResolvedValueOnce(targetQuiz);
        listContentByIdMock.mockResolvedValueOnce(content);
        listContentByIdMock.mockResolvedValueOnce(null);
        await expect(updateQuestionService(savedQuestion.id, { quizId: targetQuiz.id }, teacher.id)).rejects.toThrow("Conteúdo não encontrado");
        expectNoWrites();
    });

    test("deve impedir mover a questão para um quiz de outro professor", async () => {
        listQuizByIdMock.mockResolvedValueOnce(quiz);
        listQuizByIdMock.mockResolvedValueOnce({ ...targetQuiz, teacherId: 20 });
        listContentByIdMock.mockResolvedValueOnce(content);
        listContentByIdMock.mockResolvedValueOnce(targetContent);
        await expect(updateQuestionService(savedQuestion.id, { quizId: targetQuiz.id }, teacher.id)).rejects.toThrow("Você pode somente vincular questões aos seus próprios quizzes");
        expectNoWrites();
    });

    test("deve rejeitar uma atualização sem campos", async () => {
        await expect(updateQuestionService(savedQuestion.id, {}, teacher.id)).rejects.toThrow("Informe ao menos um campo para atualizar");
        expectNoWrites();
    });

    test("deve rejeitar a alteração para um enunciado vazio", async () => {
        await expect(updateQuestionService(savedQuestion.id, { statement: "" }, teacher.id)).rejects.toThrow("O enunciado é obrigatório");
        await expect(updateQuestionService(savedQuestion.id, { statement: "   " }, teacher.id)).rejects.toThrow("O enunciado é obrigatório");
        expectNoWrites();
    });
});

describe("Exclusão de questões", () => {
    test("deve excluir a questão própria e registrar o log", async () => {
        await deleteQuestionService(savedQuestion.id, teacher.id);
        expect(deleteQuestionMock).toHaveBeenCalledWith(savedQuestion.id);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({ userId: teacher.id, action: "EXCLUSAO_QUESTAO" }));
    });
});
