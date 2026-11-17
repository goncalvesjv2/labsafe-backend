/// <reference types="jest" />
import { beforeEach, expect } from "@jest/globals";
import { createQuizRepository, deleteQuizRepository, listQuizByContentIdRepository, listQuizByIdRepository, listQuizzesRepository, updateQuizRepository } from "../../../../repositories/quizRepository";
import { listContentByIdRepository } from "../../../../repositories/contentRepository";
import { listUserByIdRepository } from "../../../../repositories/userRepository";
import { createLogService } from "../../../../services/logService";
import { UserRole } from "../../../../utils/user";

jest.mock("../../../../repositories/quizRepository", () => ({
    listQuizzesRepository: jest.fn(),
    listQuizByIdRepository: jest.fn(),
    listQuizByContentIdRepository: jest.fn(),
    createQuizRepository: jest.fn(),
    updateQuizRepository: jest.fn(),
    deleteQuizRepository: jest.fn()
}));

jest.mock("../../../../repositories/contentRepository", () => ({
    listContentByIdRepository: jest.fn()
}));

jest.mock("../../../../repositories/userRepository", () => ({
    listUserByIdRepository: jest.fn()
}));

jest.mock("../../../../services/logService", () => ({
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

const savedQuiz = { id: 5, contentId: content.id, teacherId: teacher.id };
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

export { listQuizzesMock, listQuizByIdMock, listQuizByContentIdMock, createQuizMock, updateQuizMock, deleteQuizMock, listContentByIdMock, listUserByIdMock, createLogMock, teacher, content, savedQuiz, input, changes, updatedQuiz, expectNoWrites };
