import "dotenv/config";
import { afterAll, beforeAll, expect } from "@jest/globals";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { app } from "../../../../app";
import { prisma } from "../../../../database/prisma";
import { user_role } from "../../../../generated/prisma/enums";

export function setupUserIntegration() {
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
    let passwordHash: string;

    beforeAll(async () => {
        await app.ready();
        passwordHash = await bcrypt.hash(password, 10);

        const admin = await prisma.usuario.create({
            data: {
                name: "Administrador Teste",
                email: adminEmail,
                senha: passwordHash,
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
        await Promise.all([app.close(), prisma.$disconnect()]);
    }, 30000);

    return {
        get token() { return token; },
        get adminId() { return adminId; },
        get adminEmail() { return adminEmail; },
        get email() { return email; },
        get listEmail() { return listEmail; },
        get idEmail() { return idEmail; },
        get updateEmail() { return updateEmail; },
        get deleteEmail() { return deleteEmail; },
        get duplicateEmail() { return duplicateEmail; },
        get invalidEmail() { return invalidEmail; },
        get missingEmail() { return missingEmail; },
        get missingUpdateEmail() { return missingUpdateEmail; },
        get password() { return password; },
        get passwordHash() { return passwordHash; }
    };
}
