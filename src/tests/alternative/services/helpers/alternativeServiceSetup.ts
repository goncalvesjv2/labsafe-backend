/// <reference types="jest" />
import { beforeEach, expect } from "@jest/globals";
import { changeCorrectRepository, countAlternativesByQuestionIdRepository, createAlternativeRepository, deleteAlternativeRepository, listAlternativeByIdRepository, listAlternativesByQuestionIdRepository, listAlternativesRepository, updateAlternativeRepository } from "../../../../repositories/alternativeRepository";
import { listQuestionByIdRepository } from "../../../../repositories/questionRepository";
import { listQuizByIdRepository } from "../../../../repositories/quizRepository";
import { listUserByIdRepository } from "../../../../repositories/userRepository";
import { createLogService } from "../../../../services/logService";
import { UserRole } from "../../../../utils/user";

jest.mock("../../../../repositories/alternativeRepository", () => ({
    listAlternativesRepository: jest.fn(),
    listAlternativeByIdRepository: jest.fn(),
    listAlternativesByQuestionIdRepository: jest.fn(),
    countAlternativesByQuestionIdRepository: jest.fn(),
    createAlternativeRepository: jest.fn(),
    updateAlternativeRepository: jest.fn(),
    changeCorrectRepository: jest.fn(),
    deleteAlternativeRepository: jest.fn()
}));
jest.mock("../../../../repositories/questionRepository", () => ({ listQuestionByIdRepository: jest.fn() }));
jest.mock("../../../../repositories/quizRepository", () => ({ listQuizByIdRepository: jest.fn() }));
jest.mock("../../../../repositories/userRepository", () => ({ listUserByIdRepository: jest.fn() }));
jest.mock("../../../../services/logService", () => ({ createLogService: jest.fn() }));

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

export { listAlternativesMock, listAlternativeByIdMock, listAlternativesByQuestionIdMock, countAlternativesMock, createAlternativeMock, updateAlternativeMock, changeCorrectMock, deleteAlternativeMock, listQuestionByIdMock, listQuizByIdMock, listUserByIdMock, createLogMock, teacher, quiz, question, input, correctAlternative, incorrectAlternative, thirdAlternative, savedAlternatives, studentAlternatives, expectNoWrites };
