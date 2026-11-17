import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { UserRole } from "../../../utils/user";
import { user_role } from "../../../generated/prisma/enums";

describe("updateUserRepository", () => {
    const user = {
        name: "Ana",
        email: "ana@example.com",
        role: UserRole.PROFESSOR
    };
    const storedUser = {
        id: 7,
        name: user.name,
        email: user.email,
        senha: "hash-existente",
        role: user_role.Professor_a_,
        ativo: true
    };
    const update = jest.fn<(query: unknown) => Promise<unknown>>();

    beforeEach(() => {
        jest.resetModules();
        update.mockReset();
        update.mockResolvedValue([storedUser]);

        jest.doMock("../../../database/prisma", () => ({
            prisma: { usuario: { updateManyAndReturn: update } }
        }));
    });

    afterEach(() => {
        jest.dontMock("../../../database/prisma");
        jest.resetModules();
    });

    test("deve manter a senha existente e esconder o hash da resposta", async () => {
        const { updateUserRepository } = await import("../../../repositories/userRepository");
        const result = await updateUserRepository(7, user);
        expect(update).toHaveBeenCalledWith({
            where: { id: 7, email: user.email },
            data: {
                name: user.name,
                email: user.email,
                role: user_role.Professor_a_
            }
        });
        expect(result).toEqual({ id: 7, ...user, ativo: true, hasPassword: true });
    });

    test("deve atualizar apenas nome, e-mail e cargo mesmo recebendo campos extras", async () => {
        const { updateUserRepository } = await import("../../../repositories/userRepository");
        const input = { ...user, senha: "novo-hash", password: "NovaSenha123!", ativo: false };
        await updateUserRepository(7, input);
        expect(update).toHaveBeenCalledWith({
            where: { id: 7, email: user.email },
            data: {
                name: user.name,
                email: user.email,
                role: user_role.Professor_a_
            }
        });
    });

    test("deve retornar null quando o usuário não existe", async () => {
        const { updateUserRepository } = await import("../../../repositories/userRepository");
        update.mockResolvedValue([]);
        const result = await updateUserRepository(7, user);
        expect(result).toBeNull();
    });

    test("deve informar conflito quando o e-mail já está em uso", async () => {
        const { updateUserRepository } = await import("../../../repositories/userRepository");
        const { Prisma } = await import("../../../generated/prisma/client");
        const error = new Prisma.PrismaClientKnownRequestError("E-mail duplicado", {
            code: "P2002",
            clientVersion: Prisma.prismaVersion.client
        });
        update.mockRejectedValue(error);
        await expect(updateUserRepository(7, user)).rejects.toBe(error);
    });
});
