/// <reference types="jest" />
import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { user_role } from "../../../generated/prisma/enums";
import { UserRole } from "../../../utils/user";
import { createLogService } from "../../../services/logService";
import { sendEmailService } from "../../../services/emailService";
import { setupUserIntegration } from "./helpers/setupUserIntegration";

jest.mock("../../../services/emailService", () => ({
    sendEmailService: jest.fn().mockResolvedValue({ messageId: "email-teste" })
}));

jest.mock("../../../services/logService", () => {
    const original = jest.requireActual<typeof import("../../../services/logService")>("../../../services/logService");
    return { ...original, createLogService: jest.fn(original.createLogService) };
});

describe("Teste de integração de usuários", () => {
    const context = setupUserIntegration();

    test("deve criar um usuário salvando o e-mail em minúsculas e sem espaços nas extremidades", async () => {
        const user = { name: "Aluno Teste", email: `  ${context.email.toUpperCase()}  `, role: UserRole.ALUNO };
        let registrationCommitted = false;

        jest.mocked(sendEmailService).mockImplementationOnce(async () => {
            const savedUser = await prisma.usuario.findUnique({ where: { email: context.email } });
            registrationCommitted = savedUser?.invitation_token_hash != null;
            return { messageId: "email-teste" };
        });

        const before = Date.now();
        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${context.token}`
            },
            payload: user
        });
        const after = Date.now();
        expect(response.statusCode).toBe(201);
        expect(response.headers["content-type"]).toContain("application/json");
        const body = response.json();
        expect(body.invitationSent).toBe(true);
        expect(registrationCommitted).toBe(true);
        expect(sendEmailService).toHaveBeenCalledTimes(1);
        const sentEmail = jest.mocked(sendEmailService).mock.calls[0][0];
        expect(sentEmail.to).toBe(context.email);
        expect(sentEmail.text).toContain("5 minutos");
        const link = sentEmail.text.match(/http:\/\/localhost:5173\/reset-password\?type=invitation&token=[a-f0-9]{64}/);
        assert.ok(link);
        const invitationToken = new URL(link[0]).searchParams.get("token");
        assert.ok(invitationToken);
        expect(body).toMatchObject({ id: expect.any(Number), name: user.name, email: context.email, role: user.role });
        expect(body).not.toHaveProperty("senha");
        expect(body).not.toHaveProperty("password");
        expect(body).not.toHaveProperty("token");
        expect(body).not.toHaveProperty("tokenHash");
        expect(body).not.toHaveProperty("invitationUrl");
        expect(body).not.toHaveProperty("invitation_token_hash");
        expect(body).not.toHaveProperty("invitation_expires_at");
        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { email: context.email } });
        expect(savedUser).toMatchObject({ id: body.id, name: user.name, email: context.email, role: user_role.Aluno_a_ });
        expect(savedUser.senha).toBeNull();
        expect(savedUser.invitation_token_hash).toMatch(/^[a-f0-9]{64}$/);
        expect(savedUser.invitation_token_hash).toBe(createHash("sha256").update(invitationToken).digest("hex"));
        assert.ok(savedUser.invitation_expires_at);
        expect(savedUser.invitation_expires_at.getTime()).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
        expect(savedUser.invitation_expires_at.getTime()).toBeLessThanOrEqual(after + 5 * 60 * 1000);
    }, 30000);

    test("Falha no envio do e-mail mantém o cadastro e informa que precisa reenviar o convite", async () => {
        const failedEmail = `email.falha.${randomUUID()}@example.com`;
        jest.mocked(sendEmailService).mockRejectedValueOnce(new Error("Falha no SMTP"));

        const response = await app.inject({
            method: "POST", url: "/api/users",
            headers: { authorization: `Bearer ${context.token}` },
            payload: { name: "Aluno Teste", email: failedEmail, role: UserRole.ALUNO }
        });

        expect(response.statusCode).toBe(201);
        expect(response.json().invitationSent).toBe(false);
        expect(response.json().message).toContain("Será necessário reenviar o convite");
        expect(sendEmailService).toHaveBeenCalledTimes(1);
        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { email: failedEmail } });
        expect(response.json().id).toBe(savedUser.id);
        expect(savedUser.senha).toBeNull();
        expect(savedUser.invitation_token_hash).not.toBeNull();
        expect(savedUser.invitation_expires_at).not.toBeNull();
        expect(await prisma.logs.count({
            where: { user_id: context.adminId, action: "CADASTRO_USUARIO", description: { contains: failedEmail } }
        })).toBe(1);
    });

    test("Falha ao salvar o log desfaz o cadastro e o convite", async () => {
        const failedEmail = `cadastro.falha.${randomUUID()}@example.com`;
        jest.mocked(createLogService).mockRejectedValueOnce(new Error("Falha ao salvar log"));

        const response = await app.inject({
            method: "POST", url: "/api/users",
            headers: { authorization: `Bearer ${context.token}` },
            payload: { name: "Aluno Teste", email: failedEmail, role: UserRole.ALUNO }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Falha ao salvar log");
        expect(sendEmailService).not.toHaveBeenCalled();
        expect(await prisma.usuario.findUnique({ where: { email: failedEmail } })).toBeNull();
        expect(await prisma.logs.count({
            where: { user_id: context.adminId, action: "CADASTRO_USUARIO", description: { contains: failedEmail } }
        })).toBe(0);
    });

    test("deve rejeitar cadastro com e-mail já utilizado mesmo com letras maiúsculas e espaços", async () => {
        const user = { name: "Aluno Original", email: context.duplicateEmail, role: UserRole.ALUNO };
        const createResponse = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${context.token}`
            },
            payload: user
        });
        expect(createResponse.statusCode).toBe(201);
        const createdUser = createResponse.json();
        const duplicateUser = { name: "Outro Aluno", email: `  ${context.duplicateEmail.toUpperCase()}  `, role: UserRole.ALUNO };
        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${context.token}`
            },
            payload: duplicateUser
        });
        expect(response.statusCode).toBe(400);
        const body = response.json();
        expect(body.message).toBe("Usuário já possui cadastro");
        const total = await prisma.usuario.count({ where: { email: context.duplicateEmail } });
        expect(total).toBe(1);
        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { email: context.duplicateEmail } });
        expect(savedUser).toMatchObject({ id: createdUser.id, name: user.name });
    }, 30000);

    test("deve rejeitar cadastro com e-mail inválido", async () => {
        const user = { name: "Aluno Inválido", email: context.invalidEmail, role: UserRole.ALUNO };

        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${context.token}`
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

        const total = await prisma.usuario.count({ where: { email: context.invalidEmail } });
        expect(total).toBe(0);
    }, 30000);
});
