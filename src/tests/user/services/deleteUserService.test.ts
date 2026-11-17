import { describe, test, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { UserRole } from "../../../utils/user";

describe("deleteUserService", () => {
    const deleteUserRepository = jest.fn<(id: number) => Promise<unknown>>();
    const listUserByIdRepository = jest.fn<(id: number) => Promise<unknown>>();

    beforeEach(() => {
        jest.resetModules();
        deleteUserRepository.mockReset();
        listUserByIdRepository.mockReset();
        jest.doMock("../../../repositories/userRepository", () => ({ deleteUserRepository, listUserByIdRepository }));
        jest.doMock("../../../services/logService", () => ({ createLogService: jest.fn() }));
    });

    afterEach(() => {
        jest.dontMock("../../../repositories/userRepository");
        jest.dontMock("../../../services/logService");
        jest.resetModules();
    });

    test("deve bloquear a exclusão da própria conta do administrador", async () => {
        const { deleteUserService } = await import("../../../services/userService");
        listUserByIdRepository.mockResolvedValue({ id: 10, role: UserRole.ADMIN });

        await expect(deleteUserService(10, 10)).rejects.toThrow("Você não pode excluir sua própria conta");
        expect(deleteUserRepository).not.toHaveBeenCalled();
    });

    test.each([UserRole.ALUNO, UserRole.PROFESSOR])("deve permitir que exclua a própria conta", async (role) => {
        const { deleteUserService } = await import("../../../services/userService");
        const user = { id: 10, name: "Usuário Teste", role };
        listUserByIdRepository.mockResolvedValue(user);
        deleteUserRepository.mockResolvedValue(user);

        expect(await deleteUserService(10, 10)).toEqual(user);
        expect(deleteUserRepository).toHaveBeenCalledWith(10);
        expect(deleteUserRepository).toHaveBeenCalledTimes(1);
    });

    test("não deve excluir se a própria conta não for encontrada", async () => {
        const { deleteUserService } = await import("../../../services/userService");
        listUserByIdRepository.mockResolvedValue(null);
        await expect(deleteUserService(10, 10)).rejects.toThrow("Usuário não encontrado");
        expect(deleteUserRepository).not.toHaveBeenCalled();
    });

    test("deve permitir a exclusão de outro usuário", async () => {
        const { deleteUserService } = await import("../../../services/userService");
        const user = { id: 7, name: "Aluno Teste", role: UserRole.ALUNO };
        deleteUserRepository.mockResolvedValue(user);

        const result = await deleteUserService(7, 10);

        expect(result).toEqual(user);
        expect(deleteUserRepository).toHaveBeenCalledWith(7);
        expect(deleteUserRepository).toHaveBeenCalledTimes(1);
    });
});
