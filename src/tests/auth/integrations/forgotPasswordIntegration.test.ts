import { describe, expect, test } from "@jest/globals";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { sendEmailService } from "../../../services/emailService";
import { setupPasswordResetIntegration } from "./helpers/setupPasswordResetIntegration";

jest.mock("../../../services/emailService", () => ({
    sendEmailService: jest.fn().mockResolvedValue({ messageId: "email-teste" })
}));

jest.mock("../../../services/logService", () => {
    const original = jest.requireActual<typeof import("../../../services/logService")>("../../../services/logService");
    return { ...original, createLogService: jest.fn(original.createLogService) };
});

describe("Recuperação de senha", () => {
    const context = setupPasswordResetIntegration();

    describe("Solicitação do link", () => {
        test("Conta ativa recebe o link e salva somente o hash com validade de 5 minutos", async () => {
            let savedBeforeEmail = false;
            jest.mocked(sendEmailService).mockImplementationOnce(async () => {
                const user = await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } });
                savedBeforeEmail = user.password_reset_token_hash !== null;
                return { messageId: "email-teste" };
            });

            const before = Date.now();
            const response = await context.requestRecovery(`  ${context.email.toUpperCase()}  `);
            const after = Date.now();
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual(context.genericResponse);
            expect(sendEmailService).toHaveBeenCalledTimes(1);
            expect(savedBeforeEmail).toBe(true);
            const sentEmail = jest.mocked(sendEmailService).mock.calls[0][0];
            expect(sentEmail.to).toBe(context.email);
            expect(sentEmail.text).toContain("5 minutos");

            const token = context.getEmailToken();
            const user = await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } });
            expect(user.password_reset_token_hash).toBe(createHash("sha256").update(token).digest("hex"));
            expect(user.password_reset_token_hash).not.toBe(token);
            expect(user.senha).toBe(context.passwordHash);
            assert.ok(user.password_reset_expires_at);
            expect(user.password_reset_expires_at.getTime()).toBeGreaterThanOrEqual(before + 300000);
            expect(user.password_reset_expires_at.getTime()).toBeLessThanOrEqual(after + 300000);
        });

        test("E-mail não cadastrado recebe a mensagem genérica sem enviar e-mail", async () => {
            const response = await context.requestRecovery(`inexistente.${randomUUID()}@example.com`);
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual(context.genericResponse);
            expect(sendEmailService).not.toHaveBeenCalled();
        });

        test("Conta inativa não recebe link nem sofre alterações", async () => {
            const before = await prisma.usuario.update({ where: { id: context.userId }, data: { ativo: false } });
            const response = await context.requestRecovery();
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual(context.genericResponse);
            expect(sendEmailService).not.toHaveBeenCalled();
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } })).toEqual(before);
        });

        test("Conta sem senha definida não recebe link de recuperação", async () => {
            const before = await prisma.usuario.update({ where: { id: context.userId }, data: { senha: null } });
            const response = await context.requestRecovery();
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual(context.genericResponse);
            expect(sendEmailService).not.toHaveBeenCalled();
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } })).toEqual(before);
        });

        test("Solicitação rejeita e-mail ausente, inválido e campos extras", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } });
            const invalidBodies = [{}, { email: "invalido" }, { email: 123 }, { email: "   " }, { email: context.email, role: "Admin" }];
            for (const payload of invalidBodies) {
                const response = await app.inject({ method: "POST", url: "/auth/forgot-password", payload });
                expect(response.statusCode).toBe(400);
                expect(response.json().message).toBe("Dados inválidos");
                expect(response.json().errors).toEqual(expect.any(Array));
            }
            expect(sendEmailService).not.toHaveBeenCalled();
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } })).toEqual(before);
        });

        test("Nova solicitação substitui o link anterior e renova a validade", async () => {
            expect((await context.requestRecovery()).statusCode).toBe(200);
            const firstToken = context.getEmailToken();
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } });
            expect((await context.requestRecovery()).statusCode).toBe(200);
            const secondToken = context.getEmailToken(1);
            expect(secondToken).not.toBe(firstToken);
            const after = await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } });
            expect(after.password_reset_token_hash).toBe(createHash("sha256").update(secondToken).digest("hex"));
            assert.ok(before.password_reset_expires_at);
            assert.ok(after.password_reset_expires_at);
            expect(after.password_reset_expires_at.getTime()).toBeGreaterThanOrEqual(before.password_reset_expires_at.getTime());
            expect(after.senha).toBe(context.passwordHash);
            expect((await context.resetPassword(firstToken)).statusCode).toBe(400);
            expect((await context.resetPassword(secondToken)).statusCode).toBe(200);
        });

        test("Falha no envio mantém a senha atual e a mesma resposta genérica", async () => {
            jest.mocked(sendEmailService).mockRejectedValueOnce(new Error("Falha no SMTP"));
            const response = await context.requestRecovery();
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual(context.genericResponse);
            const user = await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } });
            expect(user.senha).toBe(context.passwordHash);
            expect(user.password_reset_token_hash).not.toBeNull();
            expect(user.password_reset_expires_at).not.toBeNull();

            expect((await context.requestRecovery()).statusCode).toBe(200);
            expect(sendEmailService).toHaveBeenCalledTimes(2);
            expect((await context.resetPassword(context.getEmailToken(1))).statusCode).toBe(200);
        });
    });
});
