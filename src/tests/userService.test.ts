import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { UserRole } from "../utils/user";

describe("createUserService", () => {
    beforeEach(() => {
        jest.resetModules();
    });

    test("deve cadastrar um usuário com sucesso", async () => {
        const createUserRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const listUserByEmailRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const createLogService = jest.fn<(...args: any[]) => Promise<any>>();

        jest.doMock("../repositories/userRepository", () => ({
            createUserRepository,
            listUserByEmailRepository,
            listUsersRepository: jest.fn(),
            listUserByIdRepository: jest.fn(),
            updateUserRepository: jest.fn(),
            deleteUserRepository: jest.fn(),
        }));

        jest.doMock("../services/logService", () => ({
            createLogService,
        }));

        const { createUserService } = await import("../services/userService");

        const user = {
            name: "João",
            email: "joao.teste@example.com",
            password: "Senha123!",
            role: UserRole.ALUNO,
        };

        const userId = 10;

        const createdUser = {
            id: 1,
            name: user.name,
            email: user.email,
            role: user.role,
            ativo: true,
        };

        listUserByEmailRepository.mockResolvedValue(undefined);
        createUserRepository.mockResolvedValue(createdUser);
        createLogService.mockResolvedValue(undefined);

        const result = await createUserService(user, userId);

        expect(result).toEqual(createdUser);
        expect(listUserByEmailRepository).toHaveBeenCalledWith(user.email);
        expect(createUserRepository).toHaveBeenCalledTimes(1);
        expect(createLogService).toHaveBeenCalledWith({
            userId,
            action: "CADASTRO_USUARIO",
            description: `Usuário com o e-mail ${createdUser.email} foi cadastrado`,
        });
    });

    test("deve lançar um erro se o e-mail já estiver cadastrado", async () => {
        const createUserRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const listUserByEmailRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const createLogService = jest.fn<(...args: any[]) => Promise<any>>();

        jest.doMock("../repositories/userRepository", () => ({
            createUserRepository,
            listUserByEmailRepository,
            listUsersRepository: jest.fn(),
            listUserByIdRepository: jest.fn(),
            updateUserRepository: jest.fn(),
            deleteUserRepository: jest.fn(),
        }));

        jest.doMock("../services/logService", () => ({
            createLogService,
        }));

        const { createUserService } = await import("../services/userService");

        const user = {
            name: "João",
            email: "joao.teste@example.com",
            password: "Senha123!",
            role: UserRole.ALUNO,
        };

        const existUser = {
            id: 1,
            name: "João",
            email: user.email,
            role: UserRole.ALUNO,
            ativo: true,
        }

        listUserByEmailRepository.mockResolvedValue({ email: user.email });

        await expect(createUserService(user, 10)).rejects.toThrow("Usuário já possui cadastro");
        expect(listUserByEmailRepository).toHaveBeenCalledWith(user.email);
        expect(createUserRepository).not.toHaveBeenCalled();
        expect(createLogService).not.toHaveBeenCalled();
    });

    test("deve impedir o cadastro com role inválido", async () => {
        const createUserRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const listUserByEmailRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const createLogService = jest.fn<(...args: any[]) => Promise<any>>();

        jest.doMock("../repositories/userRepository", () => ({
            createUserRepository,
            listUserByEmailRepository,
            listUsersRepository: jest.fn(),
            listUserByIdRepository: jest.fn(),
            updateUserRepository: jest.fn(),
            deleteUserRepository: jest.fn(),
        }));

        jest.doMock("../services/logService", () => ({
            createLogService,
        }));

        const { createUserService } = await import("../services/userService");

        const user = {
            name: "João",
            email: "joao.teste@example.com",
            password: "Senha123!",
            role: "Diretor" as UserRole,
        };

        await expect(createUserService(user, 10)).rejects.toThrow("Esse role não é válido");

        expect(listUserByEmailRepository).not.toHaveBeenCalled();
        expect(createUserRepository).not.toHaveBeenCalled();
        expect(createLogService).not.toHaveBeenCalled();
    });
});