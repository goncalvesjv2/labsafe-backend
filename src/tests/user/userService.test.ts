import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { UserRole } from "../../utils/user";

describe("createUserService", () => {
    beforeEach(() => {
        jest.resetModules();
    });

    test("deve cadastrar um usuário com sucesso", async () => {
        const createUserRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const listUserByEmailRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const createLogService = jest.fn<(...args: any[]) => Promise<any>>();

        jest.doMock("../../repositories/userRepository", () => ({
            createUserRepository,
            listUserByEmailRepository,
            listUsersRepository: jest.fn(),
            listUserByIdRepository: jest.fn(),
            updateUserRepository: jest.fn(),
            deleteUserRepository: jest.fn(),
        }));

        jest.doMock("../../services/logService", () => ({
            createLogService,
        }));

        const { createUserService } = await import("../../services/userService");

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

        jest.doMock("../../repositories/userRepository", () => ({
            createUserRepository,
            listUserByEmailRepository,
            listUsersRepository: jest.fn(),
            listUserByIdRepository: jest.fn(),
            updateUserRepository: jest.fn(),
            deleteUserRepository: jest.fn(),
        }));

        jest.doMock("../../services/logService", () => ({
            createLogService,
        }));

        const { createUserService } = await import("../../services/userService");

        const user = {
            name: "João",
            email: "joao.teste@example.com",
            password: "Senha123!",
            role: UserRole.ALUNO,
        };

        listUserByEmailRepository.mockResolvedValue({ email: user.email });

        await expect(createUserService(user, 10)).rejects.toThrow("Usuário já possui cadastro");
        expect(listUserByEmailRepository).toHaveBeenCalledWith(user.email);
        expect(createUserRepository).not.toHaveBeenCalled();
        expect(createLogService).not.toHaveBeenCalled();
    });
});

describe("updateUserService", () => {
    const user = {
        name: "João",
        email: "joao@example.com",
        role: UserRole.PROFESSOR
    };
    const savedUser = { id: 7, ...user, ativo: true };

    const updateUserRepository = jest.fn<(id: number, user: unknown, password: string) => Promise<unknown>>();
    const createLogService = jest.fn<(log: unknown) => Promise<unknown>>();
    const hashPassword = jest.fn<(password: string, rounds: number) => Promise<string>>();

    beforeEach(() => {
        jest.resetModules();
        updateUserRepository.mockReset();
        createLogService.mockReset();
        hashPassword.mockReset();

        jest.doMock("../../repositories/userRepository", () => ({ updateUserRepository }));
        jest.doMock("../../services/logService", () => ({ createLogService }));
        jest.doMock("bcrypt", () => ({
            __esModule: true,
            default: { hash: hashPassword }
        }));

        updateUserRepository.mockResolvedValue(savedUser);
        hashPassword.mockResolvedValue("hash-da-nova-senha");
    });

    afterEach(() => {
        jest.dontMock("../../repositories/userRepository");
        jest.dontMock("../../services/logService");
        jest.dontMock("bcrypt");
        jest.resetModules();
    });

    test("deve atualizar sem gerar uma nova senha", async () => {
        const { updateUserService } = await import("../../services/userService");

        const result = await updateUserService(7, user, 10);

        expect(result).toEqual(savedUser);
        expect(hashPassword).not.toHaveBeenCalled();
        expect(updateUserRepository).toHaveBeenCalledWith(7, user, "");
        expect(createLogService).toHaveBeenCalledTimes(1);
    });

    test("deve gerar o hash quando receber uma nova senha", async () => {
        const { updateUserService } = await import("../../services/userService");
        // O controller já entregou a senha tratada pelo schema.
        const input = { ...user, password: "NovaSenha123!" };

        await updateUserService(7, input, 10);

        expect(hashPassword).toHaveBeenCalledWith("NovaSenha123!", 10);
        expect(updateUserRepository).toHaveBeenCalledWith(7, input, "hash-da-nova-senha");
        expect(createLogService).toHaveBeenCalledTimes(1);
    });

    test("deve informar quando o usuário não existe", async () => {
        const { updateUserService } = await import("../../services/userService");
        updateUserRepository.mockResolvedValue(null);

        await expect(updateUserService(7, user, 10)).rejects.toThrow("Usuário não encontrado");
        expect(createLogService).not.toHaveBeenCalled();
    });

    test("não deve registrar sucesso se o banco falhar", async () => {
        const { updateUserService } = await import("../../services/userService");
        updateUserRepository.mockRejectedValue(new Error("Falha no banco"));

        await expect(updateUserService(7, user, 10)).rejects.toThrow("Falha no banco");
        expect(createLogService).not.toHaveBeenCalled();
    });
});
