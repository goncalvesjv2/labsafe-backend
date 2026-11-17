/// <reference types="jest" />
import { beforeEach, expect } from "@jest/globals";
import { countQuestionsByQuizIdRepository, createQuestionRepository, deleteQuestionRepository, listQuestionByIdRepository, listQuestionsByQuizIdRepository, listQuestionsRepository, updateQuestionRepository } from "../../../../repositories/questionRepository";
import { listQuizByIdRepository } from "../../../../repositories/quizRepository";
import { listContentByIdRepository } from "../../../../repositories/contentRepository";
import { listUserByIdRepository } from "../../../../repositories/userRepository";
import { createLogService } from "../../../../services/logService";
import { UserRole } from "../../../../utils/user";

jest.mock("../../../../repositories/questionRepository", () => ({
    listQuestionsRepository: jest.fn(),
    listQuestionByIdRepository: jest.fn(),
    listQuestionsByQuizIdRepository: jest.fn(),
    countQuestionsByQuizIdRepository: jest.fn(),
    createQuestionRepository: jest.fn(),
    updateQuestionRepository: jest.fn(),
    deleteQuestionRepository: jest.fn()
}));
jest.mock("../../../../repositories/quizRepository", () => ({ listQuizByIdRepository: jest.fn() }));
jest.mock("../../../../repositories/contentRepository", () => ({ listContentByIdRepository: jest.fn() }));
jest.mock("../../../../repositories/userRepository", () => ({ listUserByIdRepository: jest.fn() }));
jest.mock("../../../../services/logService", () => ({ createLogService: jest.fn() }));

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
const quiz = { id: 5, contentId: content.id, teacherId: teacher.id };
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

export { listQuestionsMock, listQuestionByIdMock, listQuestionsByQuizIdMock, countQuestionsMock, createQuestionMock, updateQuestionMock, deleteQuestionMock, listQuizByIdMock, listContentByIdMock, listUserByIdMock, createLogMock, teacher, content, quiz, input, savedQuestion, changes, updatedQuestion, expectNoWrites };
