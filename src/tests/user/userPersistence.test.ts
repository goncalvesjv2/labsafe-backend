import { afterAll, describe, expect, test } from "@jest/globals";
import { prisma } from "../../database/prisma";
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