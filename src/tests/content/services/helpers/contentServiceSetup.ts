/// <reference types="jest" />
import { beforeEach } from "@jest/globals";
import { createContentRepository, deleteContentRepository, listContentByIdRepository, listContentsRepository, updateContentRepository } from "../../../../repositories/contentRepository";
import { listUserByIdRepository } from "../../../../repositories/userRepository";
import { createLogService } from "../../../../services/logService";
import { UserRole } from "../../../../utils/user";

jest.mock("../../../../repositories/contentRepository", () => ({
    listContentsRepository: jest.fn(),
    listContentByIdRepository: jest.fn(),
    createContentRepository: jest.fn(),
    updateContentRepository: jest.fn(),
    deleteContentRepository: jest.fn()
}));

jest.mock("../../../../repositories/userRepository", () => ({
    listUserByIdRepository: jest.fn()
}));

jest.mock("../../../../services/logService", () => ({
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

export { listContentsMock, listContentByIdMock, createContentMock, updateContentMock, deleteContentMock, listUserByIdMock, createLogMock, teacher, input, savedContent };
