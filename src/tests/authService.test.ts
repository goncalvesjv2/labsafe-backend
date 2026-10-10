import { describe, test, jest, expect, beforeEach } from "@jest/globals";

describe("loginService", () => {
    beforeEach(() => {
        jest.resetModules();
    });

    test("deve autenticar um usuário com sucesso", async () => {
        const listUserByEmailRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const comparePassword = jest.fn<(...args: any[]) => Promise<any>>();
        const generateToken = jest.fn<(...args: any[]) => Promise<any>>();
        const createLogService = jest.fn<(...args: any[]) => Promise<any>>();
        
        jest.doMock("../repositories/userRepository", () => ({
            listUserByEmailRepository,
            createUserRepository: jest.fn(),
            listUsersRepository: jest.fn(),
            listUserByIdRepository: jest.fn(),
            updateUserRepository: jest.fn(),
            deleteUserRepository: jest.fn(),
        }));

        jest.doMock("bcrypt", () => ({
            __esModule: true,
            default: {
                compare: comparePassword,
            },
        }));

        jest.doMock("../utils/token", () => ({
            generateToken,
        }));

        jest.doMock("../services/logService", () => ({
            createLogService,
        }));

        const { loginService } = await import("../services/authService");

        const email = "joao.teste@example.com";
        const password = "Senha123!";

        const user = {
            id: 1,
            name: "João",
            email,
            senha: "hashedPassword",
            role: "Aluno(a)",
            ativo: true,
        };

        const token = {
            accessToken: "accessToken",
        };

        listUserByEmailRepository.mockResolvedValue(user);
        comparePassword.mockResolvedValue(true);
        generateToken.mockResolvedValue(token);
        createLogService.mockResolvedValue(undefined);

        const result = await loginService(email, password);

        expect(result).toEqual(token);
        expect(listUserByEmailRepository).toHaveBeenCalledWith(email);
        expect(comparePassword).toHaveBeenCalledWith(password, user.senha);
        expect(generateToken).toHaveBeenCalledWith(user);
        expect(createLogService).toHaveBeenCalledWith({
            userId: user.id,
            action: "LOGIN",
            description: `Usuário com o e-mail ${user.email} realizou login`,
        });
    });

    test("deve rejeitar o login quando o e-mail não existe", async () => {
        const listUserByEmailRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const comparePassword = jest.fn<(...args: any[]) => Promise<any>>();
        const generateToken = jest.fn<(...args: any[]) => Promise<any>>();
        const createLogService = jest.fn<(...args: any[]) => Promise<any>>();
        
        jest.doMock("../repositories/userRepository", () => ({
            listUserByEmailRepository,
        }));

        jest.doMock("bcrypt", () => ({
            __esModule: true,
            default: {
                compare: comparePassword,
            },
        }));

        jest.doMock("../utils/token", () => ({
            generateToken,
        }));

        jest.doMock("../services/logService", () => ({
            createLogService,
        }));

        const { loginService } = await import("../services/authService");

        listUserByEmailRepository.mockResolvedValue(null);

        await expect(loginService("joaovictor@email.com", "Abacaxi")).rejects.toThrow("E-mail ou senha inválidos");

        expect(comparePassword).not.toHaveBeenCalled();
        expect(generateToken).not.toHaveBeenCalled();
        expect(createLogService).not.toHaveBeenCalled();
    });

    test("deve rejeitar o login quando a senha estiver incorreta", async () => {
        const listUserByEmailRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const comparePassword = jest.fn<(...args: any[]) => Promise<any>>();
        const generateToken = jest.fn<(...args: any[]) => Promise<any>>();
        const createLogService = jest.fn<(...args: any[]) => Promise<any>>();
        
        jest.doMock("../repositories/userRepository", () => ({
            listUserByEmailRepository,
        }));

        jest.doMock("bcrypt", () => ({
            __esModule: true,
            default: {
                compare: comparePassword,
            },
        }));

        jest.doMock("../utils/token", () => ({
            generateToken,
        }));

        jest.doMock("../services/logService", () => ({
            createLogService,
        }));

        const { loginService } = await import("../services/authService");

        const user = {
            id: 1,
            name: "João",
            email: "joao.teste@example.com",
            senha: "hashedPassword",
            role: "Aluno(a)",
            ativo: true,
        }

        listUserByEmailRepository.mockResolvedValue(user);
        comparePassword.mockResolvedValue(false);

        await expect(loginService(user.email, "Abacaxi")).rejects.toThrow("E-mail ou senha inválidos");

        expect(listUserByEmailRepository).toHaveBeenCalledWith(user.email);
        expect(comparePassword).toHaveBeenCalledWith("Abacaxi", user.senha);
        expect(generateToken).not.toHaveBeenCalled();
        expect(createLogService).not.toHaveBeenCalled();
    });

    test("gerar token após autenticação válida", async () => {
        const listUserByEmailRepository = jest.fn<(...args: any[]) => Promise<any>>();
        const comparePassword = jest.fn<(...args: any[]) => Promise<any>>();
        const generateToken = jest.fn<(...args: any[]) => Promise<any>>();
        const createLogService = jest.fn<(...args: any[]) => Promise<any>>();

        jest.doMock("../repositories/userRepository", () => ({
            listUserByEmailRepository,
        }));

        jest.doMock("bcrypt", () => ({
            __esModule: true,
            default: {
                compare: comparePassword,
            },
        }));

        jest.doMock("../utils/token", () => ({
            generateToken,
        }));

        jest.doMock("../services/logService", () => ({
            createLogService,
        }));

        const { loginService } = await import("../services/authService");

        const user = {
            id: 1,
            name: "João",
            email: "joao.teste@example.com",
            senha: "hashedPassword",
            role: "Aluno(a)",
            ativo: true,
        };

        const token = {
            accessToken: "accessToken",
        };

        listUserByEmailRepository.mockResolvedValue(user);
        comparePassword.mockResolvedValue(true);
        generateToken.mockResolvedValue(token);
        createLogService.mockResolvedValue(undefined);

        const result = await loginService(user.email, "Senha123!");

        expect(comparePassword).toHaveBeenCalledWith("Senha123!", user.senha);
        expect(generateToken).toHaveBeenCalledTimes(1);
        expect(result).toBe(token);
    });
});