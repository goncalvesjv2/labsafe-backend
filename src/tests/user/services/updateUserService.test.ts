import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { UserRole } from "../../../utils/user";

describe("updateUserService", () => {
    const transaction = {};
    const user = {
        name: "Ana",
        email: "ana@example.com",
        role: UserRole.PROFESSOR
    };
    const savedUser = { id: 7, ...user, ativo: true };
    const updateUserRepository = jest.fn<(id: number, user: unknown, client: object) => Promise<unknown>>();
    const createLogService = jest.fn<(log: unknown, client: object) => Promise<unknown>>();
    const hashPassword = jest.fn<(password: string, rounds: number) => Promise<string>>();

    beforeEach(() => {
        jest.resetModules();
        updateUserRepository.mockReset();
        createLogService.mockReset();
        hashPassword.mockReset();

        jest.doMock("../../../database/prisma", () => ({
            prisma: { $transaction: async (operation: (client: object) => Promise<unknown>) => operation(transaction) }
        }));
        jest.doMock("../../../repositories/userRepository", () => ({ updateUserRepository }));
        jest.doMock("../../../services/logService", () => ({ createLogService }));
        jest.doMock("bcrypt", () => ({
            __esModule: true,
            default: { hash: hashPassword }
        }));

        updateUserRepository.mockResolvedValue(savedUser);
    });

    afterEach(() => {
        jest.dontMock("../../../database/prisma");
        jest.dontMock("../../../repositories/userRepository");
        jest.dontMock("../../../services/logService");
        jest.dontMock("bcrypt");
        jest.resetModules();
    });

    test.each([UserRole.ADMIN, UserRole.ALUNO, UserRole.PROFESSOR])("deve bloquear a edição da própria conta com cargo %s antes de salvar", async (role) => {
        const { updateUserService } = await import("../../../services/userService");

        await expect(updateUserService(10, { ...user, role }, 10)).rejects.toThrow("Você não pode editar sua própria conta");
        expect(updateUserRepository).not.toHaveBeenCalled();
        expect(createLogService).not.toHaveBeenCalled();
    });

    test("deve atualizar o usuário e salvar o log na mesma transação", async () => {
        const { updateUserService } = await import("../../../services/userService");

        const result = await updateUserService(7, user, 10);

        expect(result).toEqual(savedUser);
        expect(hashPassword).not.toHaveBeenCalled();
        expect(updateUserRepository).toHaveBeenCalledWith(7, user, transaction);
        expect(createLogService).toHaveBeenCalledTimes(1);
        expect(createLogService).toHaveBeenCalledWith({
            userId: 10,
            action: "ALTERACAO_USUARIO",
            description: `O usuário com o e-mail ${user.email} foi atualizado`
        }, transaction);
    });

    test("deve informar quando o usuário não existe", async () => {
        const { updateUserService } = await import("../../../services/userService");
        updateUserRepository.mockResolvedValue(null);

        await expect(updateUserService(7, user, 10)).rejects.toThrow("Usuário não encontrado");
        expect(createLogService).not.toHaveBeenCalled();
    });

    test("não deve registrar sucesso se o banco falhar", async () => {
        const { updateUserService } = await import("../../../services/userService");
        updateUserRepository.mockRejectedValue(new Error("Falha no banco"));
        await expect(updateUserService(7, user, 10)).rejects.toThrow("Falha no banco");
        expect(createLogService).not.toHaveBeenCalled();
    });
});
