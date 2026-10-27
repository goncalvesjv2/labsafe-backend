import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { app } from "../../app";
import { prisma } from "../../database/prisma";
import { generateToken } from "../../utils/token";
import { UserRole } from "../../utils/user";
import { user_role } from "../../generated/prisma/enums";
import bcrypt from "bcrypt";

describe("API de usuários", () => {
    let userId: number | undefined;
    let email: string;
    let token: string;

    beforeAll(async () => {
        await app.ready();
        const admin = { id: 1, name: "Administrador Teste", role: user_role.Admin };
        token = generateToken(admin).token;
    });

    beforeEach(async () => {
        userId = undefined;
        email = "teste.e2e." + Date.now() + "@example.com";

        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: { authorization: "Bearer " + token },
            payload: {
                name: "Usuário E2E",
                email,
                password: "  SenhaTeste123!  ",
                role: UserRole.ALUNO
            }
        });

        expect(response.statusCode).toBe(201);
        userId = response.json().id;
        expect(userId).toBeDefined();
    });

    afterEach(async () => {
        if (userId !== undefined) {
            try {
                await prisma.logs.deleteMany({ where: { user_id: userId } });
                await prisma.usuario.delete({ where: { id: userId } });
            } finally {
                userId = undefined;
            }
        }
    });

    afterAll(async () => {
        try {
            await app.close();
        } finally {
            await prisma.$disconnect();
        }
    });

    test("deve cadastrar, consultar e salvar o hash da senha sem espaços externos", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/users/" + userId,
            headers: { authorization: "Bearer " + token }
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ id: userId, email, name: "Usuário E2E" });
        expect(response.json()).not.toHaveProperty("senha");
        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
        expect(await bcrypt.compare("SenhaTeste123!", savedUser.senha)).toBe(true);
        expect(await bcrypt.compare("  SenhaTeste123!  ", savedUser.senha)).toBe(false);
    });

    test("deve atualizar nome, e-mail e cargo sem trocar a senha", async () => {
        const beforeUpdate = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
        const updatedEmail = "ana." + Date.now() + "@example.com";

        const response = await app.inject({
            method: "PATCH",
            url: "/api/users/" + userId,
            headers: { authorization: "Bearer " + token },
            payload: { name: "  Ana  ", email: updatedEmail, role: UserRole.PROFESSOR }
        });

        expect(response.statusCode).toBe(200);
        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
        expect(savedUser.name).toBe("Ana");
        expect(savedUser.email).toBe(updatedEmail);
        expect(savedUser.role).toBe(user_role.Professor_a_);
        expect(savedUser.senha).toBe(beforeUpdate.senha);
    });

    test("deve trocar a senha e permitir login", async () => {
        const updatedEmail = "ana." + Date.now() + "@example.com";
        const response = await app.inject({
            method: "PATCH",
            url: "/api/users/" + userId,
            headers: { authorization: "Bearer " + token },
            payload: {
                name: "Ana", email: updatedEmail, role: UserRole.ALUNO,
                password: "  NovaSenhaTeste123!  "
            }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).not.toHaveProperty("senha");
        expect(response.json()).not.toHaveProperty("password");
        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
        expect(savedUser.name).toBe("Ana");
        expect(savedUser.email).toBe(updatedEmail);
        expect(savedUser.senha).not.toBe("NovaSenhaTeste123!");
        expect(await bcrypt.compare("NovaSenhaTeste123!", savedUser.senha)).toBe(true);
        expect(await bcrypt.compare("  NovaSenhaTeste123!  ", savedUser.senha)).toBe(false);
        expect(await bcrypt.compare("SenhaTeste123!", savedUser.senha)).toBe(false);

        const loginResponse = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email: updatedEmail, password: "  NovaSenhaTeste123!  " }
        });
        expect(loginResponse.statusCode).toBe(200);
        expect(loginResponse.json()).toHaveProperty("token");
    });

    test("deve rejeitar senha curta após o trim sem alterar o usuário", async () => {
        const beforeUpdate = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });

        const response = await app.inject({
            method: "PATCH",
            url: "/api/users/" + userId,
            headers: { authorization: "Bearer " + token },
            payload: {
                name: "Não deve ser salvo", email, role: UserRole.ALUNO,
                password: "  1234567  "
            }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Dados inválidos");
        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
        expect(savedUser).toEqual(beforeUpdate);
    });

    test("deve rejeitar um ID inválido", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: "/api/users/abc",
            headers: { authorization: "Bearer " + token },
            payload: { name: "Usuário E2E", email, role: UserRole.ALUNO }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("ID inválido");
    });

    test("deve rejeitar atualização sem e-mail e cargo", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: "/api/users/" + userId,
            headers: { authorization: "Bearer " + token },
            payload: { name: "Usuário E2E" }
        });

        expect(response.statusCode).toBe(400);
    });

    test("deve exigir autenticação para atualizar", async () => {
        const response = await app.inject({
            method: "PATCH",
            url: "/api/users/" + userId,
            payload: { name: "Usuário E2E", email, role: UserRole.ALUNO }
        });

        expect(response.statusCode).toBe(401);
    });

    test("deve impedir que um aluno atualize usuários", async () => {
        const studentToken = app.jwt.sign({ sub: userId, role: UserRole.ALUNO });
        const response = await app.inject({
            method: "PATCH",
            url: "/api/users/" + userId,
            headers: { authorization: "Bearer " + studentToken },
            payload: { name: "Usuário E2E", email, role: UserRole.ALUNO }
        });

        expect(response.statusCode).toBe(403);
    });

    test("deve informar quando o usuário não existe", async () => {
        const deletedId = userId;
        await prisma.usuario.delete({ where: { id: deletedId } });
        userId = undefined;

        const response = await app.inject({
            method: "PATCH",
            url: "/api/users/" + deletedId,
            headers: { authorization: "Bearer " + token },
            payload: { name: "Usuário E2E", email, role: UserRole.ALUNO }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Usuário não encontrado");
    });
});
