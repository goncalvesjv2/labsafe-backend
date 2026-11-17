import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { UserRole } from "../../../utils/user";
import type { IEmail } from "../../../interfaces/IEmail";

describe("createUserService", () => {
    const transaction = {};
    const sendEmailService = jest.fn<(email: IEmail) => Promise<{ messageId: string }>>();

    beforeEach(() => {
        jest.resetModules();
        sendEmailService.mockReset();
        sendEmailService.mockResolvedValue({ messageId: "email-teste" });
        jest.doMock("../../../services/emailService", () => ({ sendEmailService }));
        jest.doMock("../../../database/prisma", () => ({
            prisma: { $transaction: async (operation: (client: object) => Promise<unknown>) => operation(transaction) }
        }));
    });

    afterEach(() => {
        jest.dontMock("../../../database/prisma");
        jest.dontMock("../../../services/emailService");
    });

    test("deve cadastrar o usuário e salvar o convite na mesma transação", async () => {
        const createUserRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const saveUserInvitationRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const listUserByEmailRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const createLogService = jest.fn<(...args: any[]) => Promise<any>>();

        jest.doMock("../../../repositories/userRepository", () => ({
            createUserRepository,
            saveUserInvitationRepository,
            listUserByEmailRepository,
            listUsersRepository: jest.fn(),
            listUserByIdRepository: jest.fn(),
            updateUserRepository: jest.fn(),
            deleteUserRepository: jest.fn(),
        }));

        jest.doMock("../../../services/logService", () => ({
            createLogService,
        }));

        const { createUserService } = await import("../../../services/userService");

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

        jest.doMock("../../../repositories/userRepository", () => ({
            createUserRepository,
            listUserByEmailRepository,
            listUsersRepository: jest.fn(),
            listUserByIdRepository: jest.fn(),
            updateUserRepository: jest.fn(),
            deleteUserRepository: jest.fn(),
        }));

        jest.doMock("../../../services/logService", () => ({
            createLogService,
        }));

        const { createUserService } = await import("../../../services/userService");

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
