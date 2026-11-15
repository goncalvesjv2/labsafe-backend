import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { UserRole } from "../../utils/user";
import type { IEmail } from "../../interfaces/IEmail";

describe("createUserService", () => {
    const transaction = {};
    const sendEmailService = jest.fn<(email: IEmail) => Promise<{ messageId: string }>>();

    beforeEach(() => {
        jest.resetModules();
        sendEmailService.mockReset();
        sendEmailService.mockResolvedValue({ messageId: "email-teste" });
        jest.doMock("../../services/emailService", () => ({ sendEmailService }));
        jest.doMock("../../database/prisma", () => ({
            prisma: { $transaction: async (operation: (client: object) => Promise<unknown>) => operation(transaction) }
        }));
    });

    afterEach(() => {
        jest.dontMock("../../database/prisma");
        jest.dontMock("../../services/emailService");
    });

    test("deve cadastrar o usuário e salvar o convite na mesma transação", async () => {
        const createUserRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const saveUserInvitationRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const listUserByEmailRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const createLogService = jest.fn<(...args: any[]) => Promise<any>>();

        jest.doMock("../../repositories/userRepository", () => ({
            createUserRepository,
            saveUserInvitationRepository,
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
        saveUserInvitationRepository.mockResolvedValue(createdUser);
        createLogService.mockResolvedValue(undefined);

        const result = await createUserService(user, userId);

        expect(result).toEqual({ ...createdUser, invitationSent: true });
        expect(sendEmailService).toHaveBeenCalledTimes(1);
        expect(sendEmailService).toHaveBeenCalledWith({
            to: createdUser.email,
            subject: "LabSafe - Crie sua senha",
            text: expect.stringContaining("/reset-password?type=invitation&token=")
        });
        expect(listUserByEmailRepository).toHaveBeenCalledWith(user.email);
        expect(createUserRepository).toHaveBeenCalledTimes(1);
        expect(createUserRepository).toHaveBeenCalledWith(user, transaction);
        expect(saveUserInvitationRepository).toHaveBeenCalledWith(createdUser.id, expect.any(String), expect.any(Date), transaction);
        expect(createLogService).toHaveBeenCalledWith({
            userId,
            action: "CADASTRO_USUARIO",
            description: `Usuário com o e-mail ${createdUser.email} foi cadastrado`,
        }, transaction);
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
            role: UserRole.ALUNO,
        };

        listUserByEmailRepository.mockResolvedValue({ email: user.email });

        await expect(createUserService(user, 10)).rejects.toThrow("Usuário já possui cadastro");
        expect(listUserByEmailRepository).toHaveBeenCalledWith(user.email);
        expect(createUserRepository).not.toHaveBeenCalled();
        expect(createLogService).not.toHaveBeenCalled();
        expect(sendEmailService).not.toHaveBeenCalled();
    });
});

describe("deleteUserService", () => {
    const deleteUserRepository = jest.fn<(id: number) => Promise<unknown>>();

    beforeEach(() => {
        jest.resetModules();
        deleteUserRepository.mockReset();
        jest.doMock("../../repositories/userRepository", () => ({ deleteUserRepository }));
        jest.doMock("../../services/logService", () => ({ createLogService: jest.fn() }));
    });

    afterEach(() => {
        jest.dontMock("../../repositories/userRepository");
        jest.dontMock("../../services/logService");
        jest.resetModules();
    });

    test("deve bloquear a exclusão da própria conta antes de acessar o banco", async () => {
        const { deleteUserService } = await import("../../services/userService");

        await expect(deleteUserService(10, 10)).rejects.toThrow("Você não pode excluir sua própria conta");
        expect(deleteUserRepository).not.toHaveBeenCalled();
    });

    test("deve permitir a exclusão de outro usuário", async () => {
        const { deleteUserService } = await import("../../services/userService");
        const user = { id: 7, name: "Aluno Teste", role: UserRole.ALUNO };
        deleteUserRepository.mockResolvedValue(user);

        const result = await deleteUserService(7, 10);

        expect(result).toEqual(user);
        expect(deleteUserRepository).toHaveBeenCalledWith(7);
        expect(deleteUserRepository).toHaveBeenCalledTimes(1);
    });
});

describe("updateUserService", () => {
    const user = {
        name: "Ana",
        email: "ana@example.com",
        role: UserRole.PROFESSOR
    };
    const savedUser = { id: 7, ...user, ativo: true };

    const updateUserRepository = jest.fn<(id: number, user: unknown) => Promise<unknown>>();
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
        expect(updateUserRepository).toHaveBeenCalledWith(7, user);
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
