/// <reference types="jest" />
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { generateToken } from "../../../utils/token";
import { UserRole } from "../../../utils/user";
import { user_role } from "../../../generated/prisma/enums";
import bcrypt from "bcrypt";

jest.mock("../../../services/emailService", () => ({
    sendEmailService: jest.fn().mockResolvedValue({ messageId: "email-teste" })
}));

describe("API de usuários", () => {
    let userId: number | undefined;
    let adminId: number | undefined;
    let email: string;
    let token: string;
    let passwordHash: string;

    beforeAll(async () => {
        await app.ready();
        passwordHash = await bcrypt.hash("SenhaTeste123!", 10);
        const admin = await prisma.usuario.create({
            data: {
                name: "Administrador Teste E2E",
                email: "admin.e2e." + Date.now() + "@example.com",
                senha: passwordHash,
                role: user_role.Admin
            }
        });
        adminId = admin.id;
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
                role: UserRole.ALUNO
            }
        });

        // Guarda o ID antes das verificações para permitir a limpeza em caso de falha.
        const savedUser = await prisma.usuario.findUnique({ where: { email } });
        userId = savedUser?.id;

        expect(response.statusCode).toBe(201);
        expect(userId).toBeDefined();
        expect(response.json().id).toBe(userId);
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
            if (adminId !== undefined) {
                await prisma.logs.deleteMany({ where: { user_id: adminId } });
                await prisma.usuario.delete({ where: { id: adminId } });
            }
        } finally {
            await Promise.all([app.close(), prisma.$disconnect()]);
        }
    });

    test("deve cadastrar e consultar uma conta sem senha e impedir o login", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/users/" + userId,
            headers: { authorization: "Bearer " + token }
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ id: userId, email, name: "Usuário E2E" });
        expect(response.json()).not.toHaveProperty("senha");
        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
        expect(savedUser.senha).toBeNull();

        const login = await app.inject({
            method: "POST", url: "/auth/login",
            payload: { email, password: "SenhaTeste123!" }
        });
        expect(login.statusCode).toBe(401);
        expect(login.json()).not.toHaveProperty("token");
    });

    test("deve atualizar nome, e-mail e cargo sem trocar a senha", async () => {
        const beforeUpdate = await prisma.usuario.update({ where: { id: userId }, data: { senha: passwordHash } });
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

    test("Admin não pode trocar a senha pela edição do usuário", async () => {
        const beforeUpdate = await prisma.usuario.update({ where: { id: userId }, data: { senha: passwordHash } });
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

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Dados inválidos");
        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
        expect(savedUser).toEqual(beforeUpdate);

        const loginResponse = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password: "SenhaTeste123!" }
        });
        expect(loginResponse.statusCode).toBe(200);
        expect(loginResponse.json()).toHaveProperty("token");
        const rejectedLogin = await app.inject({
            method: "POST", url: "/auth/login",
            payload: { email, password: "NovaSenhaTeste123!" }
        });
        expect(rejectedLogin.statusCode).toBe(401);
    });

    test("Admin não pode alterar o status pela edição do usuário", async () => {
        const beforeUpdate = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });

        const response = await app.inject({
            method: "PATCH",
            url: "/api/users/" + userId,
            headers: { authorization: "Bearer " + token },
            payload: {
                name: "Não deve ser salvo", email, role: UserRole.ALUNO,
                ativo: false
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
