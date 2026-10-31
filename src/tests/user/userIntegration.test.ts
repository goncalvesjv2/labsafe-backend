import "dotenv/config";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { app } from "../../app";
import { prisma } from "../../database/prisma";
import { user_role } from "../../generated/prisma/enums";
import { UserRole } from "../../utils/user";

describe("Teste de integração de usuários", () => {
    let baseUrl: string;
    let token: string;
    const adminEmail = `admin.${randomUUID()}@example.com`;
    const email = `aluno.${randomUUID()}@example.com`;
    const listEmail = `listagem.${randomUUID()}@example.com`;
    const idEmail = `consulta.${randomUUID()}@example.com`;
    const updateEmail = `atualizacao.${randomUUID()}@example.com`;
    const deleteEmail = `exclusao.${randomUUID()}@example.com`;
    const duplicateEmail = `duplicado.${randomUUID()}@example.com`;
    const invalidEmail = `invalido.${randomUUID()}`;
    const password = "SenhaTeste123!";

    beforeAll(async () => {
        baseUrl = await app.listen({ port: 0, host: "127.0.0.1" });

        await prisma.usuario.create({
            data: {
                name: "Administrador Teste",
                email: adminEmail,
                senha: await bcrypt.hash(password, 10),
                role: user_role.Admin
            }
        });
        
        const login = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: adminEmail, password })
        });
        expect(login.status).toBe(200);
        const loginBody = await login.json();
        expect(loginBody.token).toEqual(expect.any(String));
        token = loginBody.token;
    }, 30000);

    afterAll(async () => {
        try {
            const emails = [adminEmail, email, listEmail, idEmail, updateEmail, deleteEmail, duplicateEmail, invalidEmail];
            await prisma.logs.deleteMany({ where: { usuario: { email: { in: emails } } } });
            await prisma.usuario.deleteMany({ where: { email: { in: emails } } });
        } finally {
            await Promise.all([app.close(), prisma.$disconnect()]);
        }
    }, 30000);

    test("deve criar um usuário", async () => {
        const user = { name: "Aluno Teste", email, password, role: UserRole.ALUNO };

        const response = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(user)
        });
        expect(response.status).toBe(201);
        expect(response.headers.get("content-type")).toContain("application/json");
        const body = await response.json();
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

        const createResponse = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(user)
        });
        expect(createResponse.status).toBe(201);
        const createdUser = await createResponse.json();

        const response = await fetch(`${baseUrl}/api/users`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toContainEqual(expect.objectContaining({
            id: createdUser.id,
            name: user.name,
            email: listEmail,
            role: user.role
        }));
    }, 30000);

    test("deve consultar um usuário pelo ID", async () => {
        const user = { name: "Aluno Consulta", email: idEmail, password, role: UserRole.ALUNO };
        const createResponse = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(user)
        });
        expect(createResponse.status).toBe(201);
        const createdUser = await createResponse.json();
        const response = await fetch(`${baseUrl}/api/users/${createdUser.id}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toMatchObject({
            id: createdUser.id,
            name: user.name,
            email: idEmail,
            role: user.role
        });
        expect(body).not.toHaveProperty("senha");
        expect(body).not.toHaveProperty("password");
    }, 30000);

    test("deve atualizar um usuário e salvar a alteração", async () => {
        const user = { name: "Aluno Antes", email: updateEmail, password, role: UserRole.ALUNO };

        const createResponse = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(user)
        });
        expect(createResponse.status).toBe(201);
        const createdUser = await createResponse.json();

        const updatedUser = { name: "Aluno Atualizado", email: updateEmail, role: UserRole.ALUNO };
        const response = await fetch(`${baseUrl}/api/users/${createdUser.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(updatedUser)
        });
        expect(response.status).toBe(200);
        const body = await response.json();
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
    }, 30000);

    test("deve excluir um usuário", async () => {
        const user = { name: "Aluno Exclusão", email: deleteEmail, password, role: UserRole.ALUNO };

        const createResponse = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(user)
        });
        expect(createResponse.status).toBe(201);
        const createdUser = await createResponse.json();

        const response = await fetch(`${baseUrl}/api/users/${createdUser.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(response.status).toBe(204);
        expect(await response.text()).toBe("");

        const deletedUser = await prisma.usuario.findUnique({ where: { id: createdUser.id } });
        expect(deletedUser).toBeNull();
    }, 30000);

    test("deve rejeitar cadastro com e-mail já utilizado", async () => {
        const user = { name: "Aluno Original", email: duplicateEmail, password, role: UserRole.ALUNO };
        const createResponse = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(user)
        });
        expect(createResponse.status).toBe(201);
        const createdUser = await createResponse.json();
        const duplicateUser = { name: "Outro Aluno", email: duplicateEmail, password, role: UserRole.ALUNO };
        const response = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(duplicateUser)
        });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toBe("Usuário já possui cadastro");
        const total = await prisma.usuario.count({ where: { email: duplicateEmail } });
        expect(total).toBe(1);
        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { email: duplicateEmail } });
        expect(savedUser).toMatchObject({ id: createdUser.id, name: user.name });
    }, 30000);

    test("deve rejeitar cadastro com e-mail inválido", async () => {
        const user = { name: "Aluno Inválido", email: invalidEmail, password, role: UserRole.ALUNO };

        const response = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(user)
        });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toBe("Dados inválidos");
        expect(body.errors).toContainEqual(expect.objectContaining({
            path: ["email"],
            message: "Informe um e-mail válido"
        }));

        const total = await prisma.usuario.count({ where: { email: invalidEmail } });
        expect(total).toBe(0);
    }, 30000);
});
