/// <reference types="jest" />
import { beforeEach, expect } from "@jest/globals";
import { createAttemptRepository, findApprovedAttemptByStudentAndQuizIdRepository, listAttemptByIdRepository, listAttemptsByQuizIdRepository } from "../../../../repositories/attemptRepository";
import { createAnswerRepository, listAnswersByAttemptIdRepository } from "../../../../repositories/answerRepository";
import { listAlternativesByQuestionIdRepository } from "../../../../repositories/alternativeRepository";
import { listQuestionsByQuizIdRepository } from "../../../../repositories/questionRepository";
import { listQuizByIdRepository } from "../../../../repositories/quizRepository";
import { listUserByIdRepository } from "../../../../repositories/userRepository";
import { createLogService } from "../../../../services/logService";
import { UserRole } from "../../../../utils/user";

jest.mock("../../../../database/prisma", () => ({
    prisma: {
        $transaction: jest.fn(async (callback: (transaction: object) => Promise<unknown>) => callback({}))
    }
}));
jest.mock("../../../../repositories/attemptRepository", () => ({
    createAttemptRepository: jest.fn(),
    listAttemptByIdRepository: jest.fn(),
    listAttemptsByQuizIdRepository: jest.fn(),
    findApprovedAttemptByStudentAndQuizIdRepository: jest.fn()
}));
jest.mock("../../../../repositories/answerRepository", () => ({
    createAnswerRepository: jest.fn(),
    listAnswersByAttemptIdRepository: jest.fn()
}));
jest.mock("../../../../repositories/alternativeRepository", () => ({ listAlternativesByQuestionIdRepository: jest.fn() }));
jest.mock("../../../../repositories/questionRepository", () => ({ listQuestionsByQuizIdRepository: jest.fn() }));
jest.mock("../../../../repositories/quizRepository", () => ({ listQuizByIdRepository: jest.fn() }));
jest.mock("../../../../repositories/userRepository", () => ({ listUserByIdRepository: jest.fn() }));
jest.mock("../../../../services/logService", () => ({ createLogService: jest.fn() }));

const createAttemptMock = jest.mocked(createAttemptRepository);
const listAttemptByIdMock = jest.mocked(listAttemptByIdRepository);
const listAttemptsByQuizIdMock = jest.mocked(listAttemptsByQuizIdRepository);
const findApprovedAttemptMock = jest.mocked(findApprovedAttemptByStudentAndQuizIdRepository);
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
    correctCount: 3,
    totalQuestions: 3,
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
    findApprovedAttemptMock.mockResolvedValue(null);
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

export { createAttemptMock, listAttemptByIdMock, listAttemptsByQuizIdMock, findApprovedAttemptMock, createAnswerMock, listAnswersMock, listAlternativesMock, listQuestionsMock, listQuizByIdMock, listUserByIdMock, createLogMock, teacher, student, quiz, questions, input, savedAttempt, listedAttempt, savedAnswers, expectNoWrites };
