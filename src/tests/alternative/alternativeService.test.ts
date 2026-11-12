/// <reference types="jest" />
import { beforeEach, describe, expect, test } from "@jest/globals";
import { changeCorrectService, createAlternativeService, deleteAlternativeService, listAlternativeByIdService, listAlternativesByQuestionIdService, listAlternativesService, updateAlternativeService } from "../../services/alternativeService";
import { changeCorrectRepository, countAlternativesByQuestionIdRepository, createAlternativeRepository, deleteAlternativeRepository, listAlternativeByIdRepository, listAlternativesByQuestionIdRepository, listAlternativesRepository, updateAlternativeRepository } from "../../repositories/alternativeRepository";
import { listQuestionByIdRepository } from "../../repositories/questionRepository";
import { listQuizByIdRepository } from "../../repositories/quizRepository";
import { listUserByIdRepository } from "../../repositories/userRepository";
import { createLogService } from "../../services/logService";
import { UserRole } from "../../utils/user";

jest.mock("../../repositories/alternativeRepository", () => ({
    listAlternativesRepository: jest.fn(),
    listAlternativeByIdRepository: jest.fn(),
    listAlternativesByQuestionIdRepository: jest.fn(),
    countAlternativesByQuestionIdRepository: jest.fn(),
    createAlternativeRepository: jest.fn(),
    updateAlternativeRepository: jest.fn(),
    changeCorrectRepository: jest.fn(),
    deleteAlternativeRepository: jest.fn()
}));
jest.mock("../../repositories/questionRepository", () => ({ listQuestionByIdRepository: jest.fn() }));
jest.mock("../../repositories/quizRepository", () => ({ listQuizByIdRepository: jest.fn() }));
jest.mock("../../repositories/userRepository", () => ({ listUserByIdRepository: jest.fn() }));
jest.mock("../../services/logService", () => ({ createLogService: jest.fn() }));

const listAlternativesMock = jest.mocked(listAlternativesRepository);
const listAlternativeByIdMock = jest.mocked(listAlternativeByIdRepository);
const listAlternativesByQuestionIdMock = jest.mocked(listAlternativesByQuestionIdRepository);
const countAlternativesMock = jest.mocked(countAlternativesByQuestionIdRepository);
const createAlternativeMock = jest.mocked(createAlternativeRepository);
const updateAlternativeMock = jest.mocked(updateAlternativeRepository);
const changeCorrectMock = jest.mocked(changeCorrectRepository);
const deleteAlternativeMock = jest.mocked(deleteAlternativeRepository);
const listQuestionByIdMock = jest.mocked(listQuestionByIdRepository);
const listQuizByIdMock = jest.mocked(listQuizByIdRepository);
const listUserByIdMock = jest.mocked(listUserByIdRepository);
const createLogMock = jest.mocked(createLogService);

const teacher = {
    id: 10,
    name: "Ana",
    email: "ana@example.com",
    role: UserRole.PROFESSOR,
    ativo: true
};
const quiz = { id: 5, contentId: 1, teacherId: teacher.id };
const question = { id: 8, quizId: quiz.id, statement: "Qual equipamento protege os olhos?" };
const input = [
    { questionId: question.id, text: "Óculos de proteção", correct: true },
    { questionId: question.id, text: "Luvas", correct: false }
];
const correctAlternative = { id: 1, ...input[0] };
const incorrectAlternative = { id: 2, ...input[1] };
const thirdAlternative = { id: 3, questionId: question.id, text: "Jaleco", correct: false };
const savedAlternatives = [correctAlternative, incorrectAlternative];
const studentAlternatives = [
    { id: 1, questionId: question.id, text: "Óculos de proteção" },
    { id: 2, questionId: question.id, text: "Luvas" }
];

beforeEach(() => {
    jest.resetAllMocks();
    listUserByIdMock.mockResolvedValue(teacher);
    listQuizByIdMock.mockResolvedValue(quiz);
    listQuestionByIdMock.mockResolvedValue(question);
    listAlternativesMock.mockResolvedValue(savedAlternatives);
    listAlternativeByIdMock.mockResolvedValue(incorrectAlternative);
    listAlternativesByQuestionIdMock.mockResolvedValue(savedAlternatives);
    countAlternativesMock.mockResolvedValue(2);
    createAlternativeMock.mockResolvedValue(savedAlternatives);
    updateAlternativeMock.mockResolvedValue({ ...incorrectAlternative, text: "Luvas de proteção" });
    changeCorrectMock.mockResolvedValue({ ...incorrectAlternative, correct: true });
    deleteAlternativeMock.mockResolvedValue(undefined);
});

function expectNoWrites() {
    expect(createAlternativeMock).not.toHaveBeenCalled();
    expect(updateAlternativeMock).not.toHaveBeenCalled();
    expect(changeCorrectMock).not.toHaveBeenCalled();
    expect(deleteAlternativeMock).not.toHaveBeenCalled();
    expect(createLogMock).not.toHaveBeenCalled();
}

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

describe("Cadastro de alternativas", () => {
    beforeEach(() => {
        countAlternativesMock.mockResolvedValue(0);
        listAlternativesByQuestionIdMock.mockResolvedValue([]);
    });

    test("deve cadastrar duas alternativas com uma correta e registrar os logs", async () => {
        const result = await createAlternativeService(input, teacher.id);
        expect(result).toEqual(savedAlternatives);
        expect(createAlternativeMock).toHaveBeenCalledWith(input);
        expect(createLogMock).toHaveBeenCalledTimes(2);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: teacher.id,
            action: "CADASTRO_ALTERNATIVA"
        }));
    });

    test("deve permitir cadastrar três alternativas juntas", async () => {
        const alternatives = [...input, { questionId: question.id, text: "Jaleco", correct: false }];
        const saved = [...savedAlternatives, thirdAlternative];
        createAlternativeMock.mockResolvedValue(saved);
        const result = await createAlternativeService(alternatives, teacher.id);
        expect(result).toEqual(saved);
        expect(createAlternativeMock).toHaveBeenCalledWith(alternatives);
    });

    test("deve permitir cadastrar quatro alternativas juntas", async () => {
        const fourthAlternative = { id: 4, questionId: question.id, text: "Máscara", correct: false };
        const alternatives = [
            ...input,
            { questionId: question.id, text: "Jaleco", correct: false },
            { questionId: question.id, text: "Máscara", correct: false }
        ];
        const saved = [...savedAlternatives, thirdAlternative, fourthAlternative];
        createAlternativeMock.mockResolvedValue(saved);
        const result = await createAlternativeService(alternatives, teacher.id);
        expect(result).toEqual(saved);
        expect(createAlternativeMock).toHaveBeenCalledWith(alternatives);
    });

    test("deve permitir adicionar uma alternativa quando a questão já possui duas", async () => {
        const alternative = { questionId: question.id, text: "Jaleco", correct: false };
        countAlternativesMock.mockResolvedValue(2);
        listAlternativesByQuestionIdMock.mockResolvedValue(savedAlternatives);
        createAlternativeMock.mockResolvedValue([thirdAlternative]);
        const result = await createAlternativeService([alternative], teacher.id);
        expect(result).toEqual([thirdAlternative]);
        expect(createAlternativeMock).toHaveBeenCalledWith([alternative]);
    });

    test("deve rejeitar um array vazio", async () => {
        await expect(createAlternativeService([], teacher.id)).rejects.toThrow("Informe as alternativas da questão");
        expectNoWrites();
    });

    test("deve impedir que a questão fique com apenas uma alternativa", async () => {
        await expect(createAlternativeService([input[0]], teacher.id)).rejects.toThrow("no mínimo 2 alternativas");
        expectNoWrites();
    });

    test("deve impedir que o total ultrapasse quatro alternativas", async () => {
        countAlternativesMock.mockResolvedValue(4);
        await expect(createAlternativeService([input[1]], teacher.id)).rejects.toThrow("no máximo 4 alternativas");
        expectNoWrites();
    });

    test("deve rejeitar alternativas de questões diferentes", async () => {
        const alternatives = [input[0], { ...input[1], questionId: 99 }];
        await expect(createAlternativeService(alternatives, teacher.id)).rejects.toThrow("mesma questão");
        expectNoWrites();
    });

    test("deve remover espaços das pontas do texto antes de cadastrar", async () => {
        const alternatives = [{ ...input[0], text: "  Óculos de proteção  " }, input[1]];
        await createAlternativeService(alternatives, teacher.id);
        expect(createAlternativeMock).toHaveBeenCalledWith(input);
    });

    test("deve rejeitar um texto vazio ou com somente espaços", async () => {
        await expect(createAlternativeService([{ ...input[0], text: "" }, input[1]], teacher.id)).rejects.toThrow("O texto da alternativa é obrigatório");
        await expect(createAlternativeService([{ ...input[0], text: "   " }, input[1]], teacher.id)).rejects.toThrow("O texto da alternativa é obrigatório");
        expectNoWrites();
    });

    test("deve rejeitar alternativas sem nenhuma correta", async () => {
        const alternatives = [{ ...input[0], correct: false }, input[1]];
        await expect(createAlternativeService(alternatives, teacher.id)).rejects.toThrow("exatamente 1 alternativa correta");
        expectNoWrites();
    });

    test("deve rejeitar duas alternativas corretas no mesmo cadastro", async () => {
        const alternatives = [input[0], { ...input[1], correct: true }];
        await expect(createAlternativeService(alternatives, teacher.id)).rejects.toThrow("exatamente 1 alternativa correta");
        expectNoWrites();
    });

    test("deve impedir outra correta quando já existe uma na questão", async () => {
        countAlternativesMock.mockResolvedValue(2);
        listAlternativesByQuestionIdMock.mockResolvedValue(savedAlternatives);
        await expect(createAlternativeService([input[0]], teacher.id)).rejects.toThrow("exatamente 1 alternativa correta");
        expectNoWrites();
    });
});

describe("Atualização do texto da alternativa", () => {
    test("deve atualizar somente o texto e registrar o log", async () => {
        const changes = { text: "  Luvas de proteção  ", correct: true, questionId: 99 };
        const result = await updateAlternativeService(incorrectAlternative.id, changes, teacher.id);
        expect(updateAlternativeMock).toHaveBeenCalledWith(incorrectAlternative.id, { text: "Luvas de proteção" });
        expect(result).toEqual({ ...incorrectAlternative, text: "Luvas de proteção" });
        expect(changeCorrectMock).not.toHaveBeenCalled();
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: teacher.id,
            action: "ALTERACAO_ALTERNATIVA"
        }));
    });

    test("deve rejeitar a atualização com texto vazio ou somente espaços", async () => {
        await expect(updateAlternativeService(2, { text: "" }, teacher.id)).rejects.toThrow("O texto da alternativa é obrigatório");
        await expect(updateAlternativeService(2, { text: "   " }, teacher.id)).rejects.toThrow("O texto da alternativa é obrigatório");
        expectNoWrites();
    });
});

describe("Troca da alternativa correta", () => {
    test("deve solicitar a troca da correta na questão da alternativa e registrar o log", async () => {
        const result = await changeCorrectService(incorrectAlternative.id, teacher.id);
        expect(changeCorrectMock).toHaveBeenCalledWith(incorrectAlternative.id, question.id);
        expect(result).toEqual({ ...incorrectAlternative, correct: true });
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: teacher.id,
            action: "ALTERACAO_ALTERNATIVA_CORRETA"
        }));
    });
});

describe("Exclusão de alternativas", () => {
    test("deve excluir uma incorreta quando restam duas alternativas e uma correta", async () => {
        countAlternativesMock.mockResolvedValue(3);
        listAlternativesByQuestionIdMock.mockResolvedValue([...savedAlternatives, thirdAlternative]);
        await expect(deleteAlternativeService(incorrectAlternative.id, teacher.id)).resolves.toBeUndefined();
        expect(deleteAlternativeMock).toHaveBeenCalledWith(incorrectAlternative.id);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: teacher.id,
            action: "EXCLUSAO_ALTERNATIVA"
        }));
    });

    test("deve impedir a exclusão quando a questão possui somente duas alternativas", async () => {
        await expect(deleteAlternativeService(incorrectAlternative.id, teacher.id)).rejects.toThrow("no mínimo 2 alternativas");
        expectNoWrites();
    });

    test("deve impedir a exclusão da única alternativa correta", async () => {
        countAlternativesMock.mockResolvedValue(3);
        listAlternativeByIdMock.mockResolvedValue(correctAlternative);
        listAlternativesByQuestionIdMock.mockResolvedValue([...savedAlternatives, thirdAlternative]);
        await expect(deleteAlternativeService(correctAlternative.id, teacher.id)).rejects.toThrow("manter exatamente 1 alternativa correta");
        expectNoWrites();
    });
});