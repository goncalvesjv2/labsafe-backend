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

        const userData = {
            name: "João",
            email: "joao.teste@example.com",
            password: "Senha123!",
            role: UserRole.ALUNO,
        };

        const userId = 10;

        const createdUser = {
            id: 1,
            name: userData.name,
            email: userData.email,
            role: userData.role,
            ativo: true,
        };

        listUserByEmailRepository.mockResolvedValue(undefined);
        createUserRepository.mockResolvedValue(createdUser);
        createLogService.mockResolvedValue(undefined);

        const result = await createUserService(userData, userId);

        expect(result).toEqual(createdUser);
        expect(listUserByEmailRepository).toHaveBeenCalledWith(userData.email);
        expect(createUserRepository).toHaveBeenCalledTimes(1);
        expect(createLogService).toHaveBeenCalledWith({
            userId,
            action: "CADASTRO_USUARIO",
            description: `Usuário com o e-mail ${createdUser.email} foi cadastrado`,
        });
    });
});