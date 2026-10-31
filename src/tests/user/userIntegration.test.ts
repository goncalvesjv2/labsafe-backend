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
            const emails = [adminEmail, email];
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
});
