/// <reference types="jest" />
import { beforeEach, describe, expect, test } from "@jest/globals";
import { createAttemptService, listAttemptByIdService, listAttemptsByQuizIdService, listAttemptsByStudentAndQuizIdService } from "../../services/attemptService";
import { createAttemptRepository, listAttemptByIdRepository, listAttemptsByQuizIdRepository } from "../../repositories/attemptRepository";
import { createAnswerRepository, listAnswersByAttemptIdRepository } from "../../repositories/answerRepository";
import { listAlternativesByQuestionIdRepository } from "../../repositories/alternativeRepository";
import { listQuestionsByQuizIdRepository } from "../../repositories/questionRepository";
import { listQuizByIdRepository } from "../../repositories/quizRepository";
import { listUserByIdRepository } from "../../repositories/userRepository";
import { createLogService } from "../../services/logService";
import { UserRole } from "../../utils/user";

jest.mock("../../database/prisma", () => ({
    prisma: {
        $transaction: jest.fn(async (callback: (transaction: object) => Promise<unknown>) => callback({}))
    }
}));
jest.mock("../../repositories/attemptRepository", () => ({
    createAttemptRepository: jest.fn(),
    listAttemptByIdRepository: jest.fn(),
    listAttemptsByQuizIdRepository: jest.fn()
}));
jest.mock("../../repositories/answerRepository", () => ({
    createAnswerRepository: jest.fn(),
    listAnswersByAttemptIdRepository: jest.fn()
}));
jest.mock("../../repositories/alternativeRepository", () => ({ listAlternativesByQuestionIdRepository: jest.fn() }));
jest.mock("../../repositories/questionRepository", () => ({ listQuestionsByQuizIdRepository: jest.fn() }));
jest.mock("../../repositories/quizRepository", () => ({ listQuizByIdRepository: jest.fn() }));
jest.mock("../../repositories/userRepository", () => ({ listUserByIdRepository: jest.fn() }));
jest.mock("../../services/logService", () => ({ createLogService: jest.fn() }));

const createAttemptMock = jest.mocked(createAttemptRepository);
const listAttemptByIdMock = jest.mocked(listAttemptByIdRepository);
const listAttemptsByQuizIdMock = jest.mocked(listAttemptsByQuizIdRepository);
const createAnswerMock = jest.mocked(createAnswerRepository);
const listAnswersMock = jest.mocked(listAnswersByAttemptIdRepository);
const listAlternativesMock = jest.mocked(listAlternativesByQuestionIdRepository);
const listQuestionsMock = jest.mocked(listQuestionsByQuizIdRepository);
const listQuizByIdMock = jest.mocked(listQuizByIdRepository);
const listUserByIdMock = jest.mocked(listUserByIdRepository);
const createLogMock = jest.mocked(createLogService);

const teacher = { id: 10, name: "Ana", email: "ana@example.com", role: UserRole.PROFESSOR, ativo: true };
const student = { id: 20, name: "Pedro", email: "pedro@example.com", role: UserRole.ALUNO, ativo: true };
const quiz = { id: 5, contentId: 1, teacherId: teacher.id };
const questions = [
    { id: 1, quizId: quiz.id, statement: "Primeira questão" },
    { id: 2, quizId: quiz.id, statement: "Segunda questão" },
    { id: 3, quizId: quiz.id, statement: "Terceira questão" }
];
const input = {
    quizId: quiz.id,
    answers: [
        { questionId: 1, alternativeId: 11 },
        { questionId: 2, alternativeId: 21 },
        { questionId: 3, alternativeId: 31 }
    ]
};
const savedAttempt = {
    id: 1,
    quizId: quiz.id,
    studentId: student.id,
    score: 100,
    approved: true,
    createdAt: new Date("2026-11-08T12:00:00Z")
};
const listedAttempt = { ...savedAttempt, studentName: student.name };
const savedAnswers = [
    { id: 1, attemptId: savedAttempt.id, questionId: 1, alternativeId: 11 },
    { id: 2, attemptId: savedAttempt.id, questionId: 2, alternativeId: 21 },
    { id: 3, attemptId: savedAttempt.id, questionId: 3, alternativeId: 31 }
];

beforeEach(() => {
    jest.clearAllMocks();
    listUserByIdMock.mockResolvedValue(student);
    listQuizByIdMock.mockResolvedValue(quiz);
    listQuestionsMock.mockResolvedValue(questions);
    listAlternativesMock.mockImplementation(async (questionId) => [
        { id: questionId * 10 + 1, questionId, text: "Correta", correct: true },
        { id: questionId * 10 + 2, questionId, text: "Incorreta", correct: false }
    ]);
    createAttemptMock.mockImplementation(async (attempt) => ({ ...savedAttempt, ...attempt }));
    createAnswerMock.mockResolvedValue(savedAnswers);
    listAttemptByIdMock.mockResolvedValue(listedAttempt);
    listAttemptsByQuizIdMock.mockResolvedValue([listedAttempt]);
    listAnswersMock.mockResolvedValue(savedAnswers);
    createLogMock.mockResolvedValue({ id: 1, user_id: student.id, action: "CADASTRO_TENTATIVA", description: "Tentativa enviada", created_at: savedAttempt.createdAt });
});

function expectNoWrites() {
    expect(createAttemptMock).not.toHaveBeenCalled();
    expect(createAnswerMock).not.toHaveBeenCalled();
    expect(createLogMock).not.toHaveBeenCalled();
}

describe("Criação de tentativas", () => {
    test("deve salvar a tentativa, as respostas e o log quando o aluno acerta tudo", async () => {
        const result = await createAttemptService(input, student.id);
        expect(result).toEqual({ attempt: savedAttempt, totalQuestions: 3, correctCount: 3 });
        expect(createAttemptMock).toHaveBeenCalledWith({ quizId: quiz.id, studentId: student.id, score: 100, approved: true }, expect.any(Object));
        expect(createAnswerMock).toHaveBeenCalledWith([
            { attemptId: savedAttempt.id, questionId: 1, alternativeId: 11 },
            { attemptId: savedAttempt.id, questionId: 2, alternativeId: 21 },
            { attemptId: savedAttempt.id, questionId: 3, alternativeId: 31 }
        ], createAttemptMock.mock.calls[0][1]);
        expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({ userId: student.id, action: "CADASTRO_TENTATIVA" }));
    });

    test("deve aprovar o aluno com exatamente 60 por cento", async () => {
        listQuestionsMock.mockResolvedValue([
            ...questions,
            { id: 4, quizId: quiz.id, statement: "Quarta questão" },
            { id: 5, quizId: quiz.id, statement: "Quinta questão" }
        ]);
        const submission = {
            quizId: quiz.id,
            answers: [
                ...input.answers,
                { questionId: 4, alternativeId: 42 },
                { questionId: 5, alternativeId: 52 }
            ]
        };
        const result = await createAttemptService(submission, student.id);
        expect(result.attempt.score).toBe(60);
        expect(result.attempt.approved).toBe(true);
        expect(result.correctCount).toBe(3);
    });

    test("deve reprovar o aluno que fica abaixo de 60 por cento", async () => {
        const submission = {
            quizId: quiz.id,
            answers: [
                { questionId: 1, alternativeId: 11 },
                { questionId: 2, alternativeId: 22 },
                { questionId: 3, alternativeId: 32 }
            ]
        };
        const result = await createAttemptService(submission, student.id);
        expect(result.attempt.score).toBe(33.3);
        expect(result.attempt.approved).toBe(false);
        expect(result.correctCount).toBe(1);
    });

    test("deve arredondar a nota para uma casa decimal", async () => {
        const submission = {
            quizId: quiz.id,
            answers: [
                { questionId: 1, alternativeId: 11 },
                { questionId: 2, alternativeId: 21 },
                { questionId: 3, alternativeId: 32 }
            ]
        };
        const result = await createAttemptService(submission, student.id);
        expect(result.attempt.score).toBe(66.7);
        expect(result.attempt.approved).toBe(true);
    });

    test("deve salvar nota zero quando o aluno erra todas as questões", async () => {
        const submission = {
            quizId: quiz.id,
            answers: [
                { questionId: 1, alternativeId: 12 },
                { questionId: 2, alternativeId: 22 },
                { questionId: 3, alternativeId: 32 }
            ]
        };
        const result = await createAttemptService(submission, student.id);
        expect(result.attempt.score).toBe(0);
        expect(result.attempt.approved).toBe(false);
        expect(result.correctCount).toBe(0);
    });

    test("deve criar outra tentativa quando o aluno envia o quiz novamente", async () => {
        createAttemptMock.mockResolvedValueOnce(savedAttempt);
        createAttemptMock.mockResolvedValueOnce({ ...savedAttempt, id: 2 });
        const first = await createAttemptService(input, student.id);
        const second = await createAttemptService(input, student.id);
        expect(first.attempt.id).toBe(1);
        expect(second.attempt.id).toBe(2);
        expect(createAttemptMock).toHaveBeenCalledTimes(2);
        expect(createAnswerMock.mock.calls[1][0][0].attemptId).toBe(2);
    });

    test("deve aceitar respostas enviadas em outra ordem", async () => {
        const submission = { quizId: quiz.id, answers: [input.answers[2], input.answers[0], input.answers[1]] };
        const result = await createAttemptService(submission, student.id);
        expect(result.correctCount).toBe(3);
        expect(result.attempt.score).toBe(100);
    });

    test("deve aceitar um quiz com dez questões", async () => {
        const tenQuestions = [...questions];
        const answers = [...input.answers];

        for (let id = 4; id <= 10; id++) {
            tenQuestions.push({ id, quizId: quiz.id, statement: "Questão de teste" });
            answers.push({ questionId: id, alternativeId: id * 10 + 1 });
        }

        listQuestionsMock.mockResolvedValue(tenQuestions);
        const result = await createAttemptService({ quizId: quiz.id, answers }, student.id);

        expect(result.totalQuestions).toBe(10);
        expect(result.correctCount).toBe(10);
        expect(result.attempt.score).toBe(100);
        expect(createAnswerMock.mock.calls[0][0]).toHaveLength(10);
    });

    test("deve impedir o envio quando o usuário não existe", async () => {
        listUserByIdMock.mockResolvedValue(null);
        await expect(createAttemptService(input, 999)).rejects.toThrow("Usuário não encontrado");
        expectNoWrites();
    });

    test("deve impedir o envio por professores", async () => {
        listUserByIdMock.mockResolvedValue(teacher);
        await expect(createAttemptService(input, teacher.id)).rejects.toThrow("Somente alunos podem enviar tentativas");
        expectNoWrites();
    });

    test("deve impedir o envio por administradores", async () => {
        listUserByIdMock.mockResolvedValue({ ...student, role: UserRole.ADMIN });
        await expect(createAttemptService(input, student.id)).rejects.toThrow("Somente alunos podem enviar tentativas");
        expectNoWrites();
    });

    test("deve impedir o envio para um quiz inexistente", async () => {
        listQuizByIdMock.mockResolvedValue(null);
        await expect(createAttemptService(input, student.id)).rejects.toThrow("Quiz não encontrado");
        expectNoWrites();
    });

    test("deve impedir o envio para um quiz sem questões", async () => {
        listQuestionsMock.mockResolvedValue([]);
        await expect(createAttemptService({ quizId: quiz.id, answers: [] }, student.id)).rejects.toThrow("entre 1 e 10 questões");
        expectNoWrites();
    });

    test("deve impedir o envio para um quiz com mais de dez questões", async () => {
        const elevenQuestions = [...questions];

        for (let id = 4; id <= 11; id++) {
            elevenQuestions.push({ id, quizId: quiz.id, statement: "Questão de teste" });
        }

        listQuestionsMock.mockResolvedValue(elevenQuestions);
        await expect(createAttemptService(input, student.id)).rejects.toThrow("entre 1 e 10 questões");
        expectNoWrites();
    });

    test("deve impedir o envio quando faltam respostas", async () => {
        await expect(createAttemptService({ quizId: quiz.id, answers: [input.answers[0]] }, student.id)).rejects.toThrow("Responda todas as questões do quiz");
        expectNoWrites();
    });

    test("deve impedir o envio de respostas a mais", async () => {
        const submission = { quizId: quiz.id, answers: [...input.answers, input.answers[0]] };
        await expect(createAttemptService(submission, student.id)).rejects.toThrow("Responda todas as questões do quiz");
        expectNoWrites();
    });

    test("deve impedir respostas repetidas para a mesma questão", async () => {
        const submission = { quizId: quiz.id, answers: [input.answers[0], input.answers[0], input.answers[2]] };
        await expect(createAttemptService(submission, student.id)).rejects.toThrow("exatamente uma resposta para cada questão");
        expectNoWrites();
    });

    test("deve impedir uma resposta para uma questão de outro quiz", async () => {
        const submission = {
            quizId: quiz.id,
            answers: [{ questionId: 99, alternativeId: 991 }, input.answers[1], input.answers[2]]
        };
        await expect(createAttemptService(submission, student.id)).rejects.toThrow("exatamente uma resposta para cada questão");
        expectNoWrites();
    });

    test("deve impedir uma alternativa que pertence a outra questão", async () => {
        const submission = {
            quizId: quiz.id,
            answers: [{ questionId: 1, alternativeId: 21 }, input.answers[1], input.answers[2]]
        };
        await expect(createAttemptService(submission, student.id)).rejects.toThrow("A alternativa selecionada não pertence à questão");
        expectNoWrites();
    });

    test("deve impedir questões com menos de duas alternativas", async () => {
        listAlternativesMock.mockResolvedValue([{ id: 11, questionId: 1, text: "Correta", correct: true }]);
        await expect(createAttemptService(input, student.id)).rejects.toThrow("entre 2 e 4 alternativas");
        expectNoWrites();
    });

    test("deve impedir questões com mais de quatro alternativas", async () => {
        listAlternativesMock.mockResolvedValue([
            { id: 11, questionId: 1, text: "A", correct: true },
            { id: 12, questionId: 1, text: "B", correct: false },
            { id: 13, questionId: 1, text: "C", correct: false },
            { id: 14, questionId: 1, text: "D", correct: false },
            { id: 15, questionId: 1, text: "E", correct: false }
        ]);
        await expect(createAttemptService(input, student.id)).rejects.toThrow("entre 2 e 4 alternativas");
        expectNoWrites();
    });

    test("deve impedir questões sem alternativa correta", async () => {
        listAlternativesMock.mockResolvedValue([
            { id: 11, questionId: 1, text: "A", correct: false },
            { id: 12, questionId: 1, text: "B", correct: false }
        ]);
        await expect(createAttemptService(input, student.id)).rejects.toThrow("exatamente 1 alternativa correta");
        expectNoWrites();
    });

    test("deve impedir questões com duas alternativas corretas", async () => {
        listAlternativesMock.mockResolvedValue([
            { id: 11, questionId: 1, text: "A", correct: true },
            { id: 12, questionId: 1, text: "B", correct: true }
        ]);
        await expect(createAttemptService(input, student.id)).rejects.toThrow("exatamente 1 alternativa correta");
        expectNoWrites();
    });

    test("não deve salvar respostas nem registrar sucesso se a criação da tentativa falhar", async () => {
        createAttemptMock.mockRejectedValue(new Error("Falha ao salvar tentativa"));
        await expect(createAttemptService(input, student.id)).rejects.toThrow("Falha ao salvar tentativa");
        expect(createAnswerMock).not.toHaveBeenCalled();
        expect(createLogMock).not.toHaveBeenCalled();
    });

    test("não deve registrar sucesso se a criação das respostas falhar", async () => {
        createAnswerMock.mockRejectedValue(new Error("Falha ao salvar respostas"));
        await expect(createAttemptService(input, student.id)).rejects.toThrow("Falha ao salvar respostas");
        expect(createLogMock).not.toHaveBeenCalled();
    });
});

describe("Consultas de tentativas", () => {
    beforeEach(() => {
        listUserByIdMock.mockImplementation(async (id) => id === teacher.id ? teacher : student);
    });

    test("deve consultar uma tentativa com o nome do aluno e suas respostas", async () => {
        const result = await listAttemptByIdService(savedAttempt.id, teacher.id);
        expect(result).toEqual({ ...listedAttempt, answers: savedAnswers });
        expect(listAnswersMock).toHaveBeenCalledWith(savedAttempt.id);
    });

    test("deve listar as tentativas de um quiz do professor", async () => {
        const result = await listAttemptsByQuizIdService(quiz.id, teacher.id);
        expect(result).toEqual([listedAttempt]);
        expect(listAttemptsByQuizIdMock).toHaveBeenCalledWith(quiz.id);
    });

    test("deve contar somente as tentativas do aluno no quiz selecionado", async () => {
        const secondAttempt = { ...listedAttempt, id: 2, score: 33.3, approved: false };
        const anotherStudentAttempt = { ...listedAttempt, id: 3, studentId: 30, studentName: "Outro aluno" };
        listAttemptsByQuizIdMock.mockResolvedValue([listedAttempt, secondAttempt, anotherStudentAttempt]);
        const result = await listAttemptsByStudentAndQuizIdService(student.id, quiz.id, teacher.id);
        expect(result).toEqual({ studentId: student.id, studentName: student.name, quizId: quiz.id, totalAttempts: 2, attempts: [listedAttempt, secondAttempt] });
        expect(listAttemptsByQuizIdMock).toHaveBeenCalledWith(quiz.id);
    });

    test("deve retornar lista vazia e contagem zero quando o aluno não tem tentativas", async () => {
        listAttemptsByQuizIdMock.mockResolvedValue([{ ...listedAttempt, studentId: 30, studentName: "Outro aluno" }]);
        const result = await listAttemptsByStudentAndQuizIdService(student.id, quiz.id, teacher.id);
        expect(result).toEqual({ studentId: student.id, studentName: student.name, quizId: quiz.id, totalAttempts: 0, attempts: [] });
    });

    test("deve permitir a consulta de um quiz sem tentativas", async () => {
        listAttemptsByQuizIdMock.mockResolvedValue([]);
        await expect(listAttemptsByQuizIdService(quiz.id, teacher.id)).resolves.toEqual([]);
    });

    test("deve impedir consultas quando o professor não existe", async () => {
        listUserByIdMock.mockResolvedValue(null);
        await expect(listAttemptByIdService(1, teacher.id)).rejects.toThrow("Usuário não encontrado");
        await expect(listAttemptsByQuizIdService(quiz.id, teacher.id)).rejects.toThrow("Usuário não encontrado");
        await expect(listAttemptsByStudentAndQuizIdService(student.id, quiz.id, teacher.id)).rejects.toThrow("Usuário não encontrado");
        expect(listAttemptsByQuizIdMock).not.toHaveBeenCalled();
        expect(listAnswersMock).not.toHaveBeenCalled();
    });

    test("deve impedir consultas por alunos", async () => {
        listUserByIdMock.mockResolvedValue(student);
        await expect(listAttemptByIdService(1, student.id)).rejects.toThrow("Somente professores podem consultar tentativas");
        await expect(listAttemptsByQuizIdService(quiz.id, student.id)).rejects.toThrow("Somente professores podem consultar tentativas");
        await expect(listAttemptsByStudentAndQuizIdService(student.id, quiz.id, student.id)).rejects.toThrow("Somente professores podem consultar tentativas");
        expect(listAttemptsByQuizIdMock).not.toHaveBeenCalled();
        expect(listAnswersMock).not.toHaveBeenCalled();
    });

    test("deve impedir consultas por administradores", async () => {
        listUserByIdMock.mockResolvedValue({ ...teacher, role: UserRole.ADMIN });
        await expect(listAttemptByIdService(1, teacher.id)).rejects.toThrow("Somente professores podem consultar tentativas");
        await expect(listAttemptsByQuizIdService(quiz.id, teacher.id)).rejects.toThrow("Somente professores podem consultar tentativas");
        await expect(listAttemptsByStudentAndQuizIdService(student.id, quiz.id, teacher.id)).rejects.toThrow("Somente professores podem consultar tentativas");
        expect(listAttemptsByQuizIdMock).not.toHaveBeenCalled();
        expect(listAnswersMock).not.toHaveBeenCalled();
    });

    test("deve impedir consultas de um quiz criado por outro professor", async () => {
        listQuizByIdMock.mockResolvedValue({ ...quiz, teacherId: 99 });
        await expect(listAttemptByIdService(1, teacher.id)).rejects.toThrow("seus próprios quizzes");
        await expect(listAttemptsByQuizIdService(quiz.id, teacher.id)).rejects.toThrow("seus próprios quizzes");
        await expect(listAttemptsByStudentAndQuizIdService(student.id, quiz.id, teacher.id)).rejects.toThrow("seus próprios quizzes");
        expect(listAttemptsByQuizIdMock).not.toHaveBeenCalled();
        expect(listAnswersMock).not.toHaveBeenCalled();
    });

    test("deve informar quando a tentativa não existe", async () => {
        listAttemptByIdMock.mockResolvedValue(null);
        await expect(listAttemptByIdService(999, teacher.id)).rejects.toThrow("Tentativa não encontrada");
        expect(listAnswersMock).not.toHaveBeenCalled();
    });

    test("deve informar quando o quiz não existe", async () => {
        listQuizByIdMock.mockResolvedValue(null);
        await expect(listAttemptByIdService(1, teacher.id)).rejects.toThrow("Quiz não encontrado");
        await expect(listAttemptsByQuizIdService(quiz.id, teacher.id)).rejects.toThrow("Quiz não encontrado");
        await expect(listAttemptsByStudentAndQuizIdService(student.id, quiz.id, teacher.id)).rejects.toThrow("Quiz não encontrado");
        expect(listAttemptsByQuizIdMock).not.toHaveBeenCalled();
        expect(listAnswersMock).not.toHaveBeenCalled();
    });

    test("deve informar quando o aluno consultado não existe", async () => {
        listUserByIdMock.mockResolvedValueOnce(teacher);
        listUserByIdMock.mockResolvedValueOnce(null);
        await expect(listAttemptsByStudentAndQuizIdService(999, quiz.id, teacher.id)).rejects.toThrow("Aluno não encontrado");
    });
});
