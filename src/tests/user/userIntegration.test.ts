import "dotenv/config";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { app } from "../../app";
import { prisma } from "../../database/prisma";
import { user_role } from "../../generated/prisma/enums";
import { UserRole } from "../../utils/user";

describe("Teste de integração de usuários", () => {
    let token: string;
    let adminId: number;
    const adminEmail = `admin.${randomUUID()}@example.com`;
    const email = `aluno.${randomUUID()}@example.com`;
    const listEmail = `listagem.${randomUUID()}@example.com`;
    const idEmail = `consulta.${randomUUID()}@example.com`;
    const updateEmail = `atualizacao.${randomUUID()}@example.com`;
    const deleteEmail = `exclusao.${randomUUID()}@example.com`;
    const duplicateEmail = `duplicado.${randomUUID()}@example.com`;
    const invalidEmail = `invalido.${randomUUID()}`;
    const missingEmail = `inexistente.${randomUUID()}@example.com`;
    const missingUpdateEmail = `atualizacao.inexistente.${randomUUID()}@example.com`;
    const password = "SenhaTeste123!";

    beforeAll(async () => {
        await app.ready();

        const admin = await prisma.usuario.create({
            data: {
                name: "Administrador Teste",
                email: adminEmail,
                senha: await bcrypt.hash(password, 10),
                role: user_role.Admin
            }
        });
        adminId = admin.id;
        
        const login = await app.inject({
            method: "POST",
            url: "/auth/login",
            headers: { "Content-Type": "application/json" },
            payload: { email: `  ${adminEmail.toUpperCase()}  `, password }
        });
        expect(login.statusCode).toBe(200);
        const loginBody = login.json();
        expect(loginBody.token).toEqual(expect.any(String));
        token = loginBody.token;
    }, 30000);

    afterAll(async () => {
        try {
            const emails = [adminEmail, email, listEmail, idEmail, updateEmail, deleteEmail, duplicateEmail, invalidEmail, missingEmail, missingUpdateEmail];
            await prisma.logs.deleteMany({ where: { usuario: { email: { in: emails } } } });
            await prisma.usuario.deleteMany({ where: { email: { in: emails } } });
        } finally {
            await Promise.all([app.close(), prisma.$disconnect()]);
        }
    }, 30000);

    test("deve criar um usuário salvando o e-mail em minúsculas e sem espaços nas extremidades", async () => {
        const user = { name: "Aluno Teste", email: `  ${email.toUpperCase()}  `, password, role: UserRole.ALUNO };

        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            payload: user
        });
        expect(response.statusCode).toBe(201);
        expect(response.headers["content-type"]).toContain("application/json");
        const body = response.json();
        expect(body).toMatchObject({ id: expect.any(Number), name: user.name, email, role: user.role });
        expect(body).not.toHaveProperty("senha");
        expect(body).not.toHaveProperty("password");
        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { email } });
        expect(savedUser).toMatchObject({ id: body.id, name: user.name, email, role: user_role.Aluno_a_ });
        expect(savedUser.senha).not.toBe(password);
        expect(await bcrypt.compare(password, savedUser.senha)).toBe(true);
    }, 30000);

    test("deve listar usuários e encontrar o usuário cadastrado", async () => {
        const user = { name: "Aluno Listagem", email: listEmail, password, role: UserRole.ALUNO };

        const createResponse = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            payload: user
        });
        expect(createResponse.statusCode).toBe(201);
        const createdUser = createResponse.json();

        const response = await app.inject({
            method: "GET",
            url: "/api/users",
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toContainEqual(expect.objectContaining({
            id: createdUser.id,
            name: user.name,
            email: listEmail,
            role: user.role
        }));
    }, 30000);

    test("deve consultar um usuário pelo ID", async () => {
        const user = { name: "Aluno Consulta", email: idEmail, password, role: UserRole.ALUNO };
        const createResponse = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            payload: user
        });
        expect(createResponse.statusCode).toBe(201);
        const createdUser = createResponse.json();
        const response = await app.inject({
            method: "GET",
            url: `/api/users/${createdUser.id}`,
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toMatchObject({
            id: createdUser.id,
            name: user.name,
            email: idEmail,
            role: user.role
        });
        expect(body).not.toHaveProperty("senha");
        expect(body).not.toHaveProperty("password");
    }, 30000);

    test("deve atualizar um usuário salvando o e-mail em minúsculas e sem espaços nas extremidades", async () => {
        const user = { name: "Aluno Antes", email: updateEmail, password, role: UserRole.ALUNO };

        const createResponse = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            payload: user
        });
        expect(createResponse.statusCode).toBe(201);
        const createdUser = createResponse.json();

        const updatedUser = { name: "Aluno Atualizado", email: `  ${updateEmail.toUpperCase()}  `, role: UserRole.ALUNO };
        const response = await app.inject({
            method: "PATCH",
            url: `/api/users/${createdUser.id}`,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            payload: updatedUser
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toMatchObject({
            id: createdUser.id,
            name: updatedUser.name,
            email: updateEmail,
            role: updatedUser.role
        });
        expect(body).not.toHaveProperty("senha");
        expect(body).not.toHaveProperty("password");

        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { id: createdUser.id } });
        expect(savedUser.name).toBe(updatedUser.name);
        expect(savedUser.email).toBe(updateEmail);
    }, 30000);

    test("deve impedir que o administrador exclua a própria conta", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/users/${adminId}`,
            headers: { Authorization: `Bearer ${token}` }
        });

        expect(response.statusCode).toBe(403);
        const body = response.json();
        expect(body.message).toBe("Você não pode excluir sua própria conta");

        const admin = await prisma.usuario.findUniqueOrThrow({ where: { id: adminId } });
        expect(admin.email).toBe(adminEmail);
        expect(admin.role).toBe(user_role.Admin);
        expect(admin.ativo).toBe(true);
    }, 30000);

    test("deve excluir um usuário", async () => {
        const user = { name: "Aluno Exclusão", email: deleteEmail, password, role: UserRole.ALUNO };

        const createResponse = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            payload: user
        });
        expect(createResponse.statusCode).toBe(201);
        const createdUser = createResponse.json();

        const response = await app.inject({
            method: "DELETE",
            url: `/api/users/${createdUser.id}`,
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");

        const deletedUser = await prisma.usuario.findUnique({ where: { id: createdUser.id } });
        expect(deletedUser).toBeNull();
    }, 30000);

    test("deve rejeitar cadastro com e-mail já utilizado mesmo com letras maiúsculas e espaços", async () => {
        const user = { name: "Aluno Original", email: duplicateEmail, password, role: UserRole.ALUNO };
        const createResponse = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            payload: user
        });
        expect(createResponse.statusCode).toBe(201);
        const createdUser = createResponse.json();
        const duplicateUser = { name: "Outro Aluno", email: `  ${duplicateEmail.toUpperCase()}  `, password, role: UserRole.ALUNO };
        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            payload: duplicateUser
        });
        expect(response.statusCode).toBe(400);
        const body = response.json();
        expect(body.message).toBe("Usuário já possui cadastro");
        const total = await prisma.usuario.count({ where: { email: duplicateEmail } });
        expect(total).toBe(1);
        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { email: duplicateEmail } });
        expect(savedUser).toMatchObject({ id: createdUser.id, name: user.name });
    }, 30000);

    test("deve rejeitar cadastro com e-mail inválido", async () => {
        const user = { name: "Aluno Inválido", email: invalidEmail, password, role: UserRole.ALUNO };

        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            payload: user
        });
        expect(response.statusCode).toBe(400);
        const body = response.json();
        expect(body.message).toBe("Dados inválidos");
        expect(body.errors).toContainEqual(expect.objectContaining({
            path: ["email"],
            message: "Informe um e-mail válido"
        }));

        const total = await prisma.usuario.count({ where: { email: invalidEmail } });
        expect(total).toBe(0);
    }, 30000);

    test("deve retornar erro ao consultar um usuário inexistente", async () => {
        const user = { name: "Aluno Temporário", email: missingEmail, password, role: UserRole.ALUNO };
        const createResponse = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            payload: user
        });
        expect(createResponse.statusCode).toBe(201);
        const createdUser = createResponse.json();
        const deleteResponse = await app.inject({
            method: "DELETE",
            url: `/api/users/${createdUser.id}`,
            headers: {Authorization: `Bearer ${token}`}
        });
        expect(deleteResponse.statusCode).toBe(204);
        const response = await app.inject({
            method: "GET",
            url: `/api/users/${createdUser.id}`,
            headers: {Authorization: `Bearer ${token}`}
        });
        expect(response.statusCode).toBe(404);
        const body = response.json();
        expect(body.message).toBe("Usuário não encontrado");
    }, 30000);

    test("deve retornar erro ao atualizar um usuário inexistente sem registrar sucesso", async () => {
        const user = await prisma.usuario.create({
            data: { name: "Usuário temporário", email: missingUpdateEmail, senha: "hash-de-teste", role: user_role.Aluno_a_ }
        });
        await prisma.usuario.delete({ where: { id: user.id } });

        const response = await app.inject({
            method: "PATCH",
            url: `/api/users/${user.id}`,
            headers: { authorization: `Bearer ${token}` },
            payload: { name: "Novo nome", email: missingUpdateEmail, role: UserRole.ALUNO }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Usuário não encontrado");
        expect(await prisma.usuario.findUnique({ where: { id: user.id } })).toBeNull();
        expect(await prisma.logs.count({
            where: { user_id: adminId, action: "ALTERACAO_USUARIO", description: { contains: missingUpdateEmail } }
        })).toBe(0);
    }, 30000);
});
