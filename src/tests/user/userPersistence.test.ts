import { afterAll, afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { prisma } from "../../database/prisma";
import { UserRole } from "../../utils/user";
import { user_role } from "../../generated/prisma/enums";

describe("Teste de persistência - usuário", () => {
    const email = `teste.${Date.now()}@example.com`;

    let userId: number | undefined;

    afterAll(async () => {
        try {
            if (userId !== undefined) {
                await prisma.usuario.delete({
                    where: { id: userId }
                });
            }
        } finally {
            await prisma.$disconnect();
        }
    });

    test("deve salvar e consultar um usuário", async () => {
        const createdUser = await prisma.usuario.create({
            data: {
                name: "Usuário Teste",
                email,
                senha: "senhateste",
                role: user_role.Aluno_a_
            }
        });

        userId = createdUser.id;

        const user = await prisma.usuario.findUnique({
            where: { id: userId }
        });

        expect(user).not.toBeNull();
        expect(user?.email).toBe(email);
        expect(user?.name).toBe("Usuário Teste");
    });
});

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
        update.mockResolvedValue(storedUser);

        jest.doMock("../../database/prisma", () => ({
            prisma: { usuario: { update } }
        }));
    });

    afterEach(() => {
        jest.dontMock("../../database/prisma");
        jest.resetModules();
    });

    test("deve manter a senha existente e esconder o hash da resposta", async () => {
        const { updateUserRepository } = await import("../../repositories/userRepository");
        const result = await updateUserRepository(7, user, "");
        expect(update).toHaveBeenCalledWith({
            where: { id: 7 },
            data: {
                name: user.name,
                email: user.email,
                role: user_role.Professor_a_,
                senha: undefined
            }
        });
        expect(result).toEqual({ id: 7, ...user, ativo: true });
    });

    test("deve enviar o novo hash e converter o cargo para o Prisma", async () => {
        const { updateUserRepository } = await import("../../repositories/userRepository");
        await updateUserRepository(7, user, "novo-hash");
        expect(update).toHaveBeenCalledWith({
            where: { id: 7 },
            data: {
                name: user.name,
                email: user.email,
                role: user_role.Professor_a_,
                senha: "novo-hash"
            }
        });
    });

    test("deve retornar null quando o usuário não existe", async () => {
        const { updateUserRepository } = await import("../../repositories/userRepository");
        const { Prisma } = await import("../../generated/prisma/client");
        const error = new Prisma.PrismaClientKnownRequestError("Usuário inexistente", {
            code: "P2025",
            clientVersion: Prisma.prismaVersion.client
        });
        update.mockRejectedValue(error);
        const result = await updateUserRepository(7, user, "");
        expect(result).toBeNull();
    });

    test("deve informar conflito quando o e-mail já está em uso", async () => {
        const { updateUserRepository } = await import("../../repositories/userRepository");
        const { Prisma } = await import("../../generated/prisma/client");
        const error = new Prisma.PrismaClientKnownRequestError("E-mail duplicado", {
            code: "P2002",
            clientVersion: Prisma.prismaVersion.client
        });
        update.mockRejectedValue(error);
        await expect(updateUserRepository(7, user, "")).rejects.toBe(error);
    });
});
