import { beforeEach, describe, expect, test } from "@jest/globals";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { user_role } from "../../../generated/prisma/enums";
import { createLogService } from "../../../services/logService";
import { generatePasswordReset } from "../../../utils/passwordReset";
import { generateInvitation } from "../../../utils/invitation";
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

    describe("Redefinição da senha", () => {
        let recoveryToken: string;

        beforeEach(async () => {
            const recovery = generatePasswordReset("http://localhost:5173");
            recoveryToken = recovery.token;
            await prisma.usuario.update({
                where: { id: context.userId },
                data: { password_reset_token_hash: recovery.tokenHash, password_reset_expires_at: recovery.expiresAt }
            });
        });

        test("Link válido salva a senha com bcrypt, apaga a recuperação e registra o log", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } });
            const response = await app.inject({
                method: "POST", url: "/auth/reset-password",
                payload: { token: recoveryToken, password: `  ${context.newPassword}  `, confirmPassword: context.newPassword }
            });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ message: "Senha redefinida com sucesso. Faça login para acessar o sistema." });
            const user = await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } });
            assert.ok(user.senha);
            expect(user.senha).not.toBe(context.newPassword);
            expect(user.senha).not.toBe(context.passwordHash);
            expect(await bcrypt.compare(context.newPassword, user.senha)).toBe(true);
            expect(user).toEqual({ ...before, senha: user.senha, password_reset_token_hash: null, password_reset_expires_at: null });
            expect(await prisma.logs.count({ where: { user_id: context.userId, action: "REDEFINICAO_SENHA" } })).toBe(1);
        });

        test("Usuário solicita o e-mail, redefine a senha e faz login somente com a senha nova", async () => {
            expect((await context.requestRecovery()).statusCode).toBe(200);
            expect((await context.resetPassword(context.getEmailToken())).statusCode).toBe(200);
            const oldLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: context.email, password: context.password } });
            expect(oldLogin.statusCode).toBe(401);
            const newLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email: context.email, password: context.newPassword } });
            expect(newLogin.statusCode).toBe(200);
            expect(newLogin.json().token).toEqual(expect.any(String));
        });

        test("Redefinir a senha não altera outra conta", async () => {
            const recovery = generatePasswordReset("http://localhost:5173");
            const otherUser = await prisma.usuario.create({
                data: {
                    name: "Outro Aluno", email: `outra.recuperacao.${randomUUID()}@example.com`,
                    senha: context.passwordHash, role: user_role.Aluno_a_,
                    password_reset_token_hash: recovery.tokenHash,
                    password_reset_expires_at: recovery.expiresAt
                }
            });
            expect((await context.resetPassword(recoveryToken)).statusCode).toBe(200);
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: otherUser.id } })).toEqual(otherUser);
        });

        test("Token inexistente não altera a senha", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } });
            const response = await context.resetPassword("0".repeat(64));
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Link de recuperação inválido ou expirado");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } })).toEqual(before);
        });

        test("Link expirado não altera a senha", async () => {
            const before = await prisma.usuario.update({ where: { id: context.userId }, data: { password_reset_expires_at: new Date(Date.now() - 1000) } });
            const response = await context.resetPassword(recoveryToken);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Link de recuperação inválido ou expirado");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } })).toEqual(before);
        });

        test("Link sem data de expiração não altera a senha", async () => {
            const before = await prisma.usuario.update({ where: { id: context.userId }, data: { password_reset_expires_at: null } });
            const response = await context.resetPassword(recoveryToken);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Link de recuperação inválido ou expirado");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } })).toEqual(before);
        });

        test("Conta inativa não pode redefinir a senha", async () => {
            const before = await prisma.usuario.update({ where: { id: context.userId }, data: { ativo: false } });
            const response = await context.resetPassword(recoveryToken);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Usuário inativo");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } })).toEqual(before);
        });

        test("Conta sem senha definida não pode usar a recuperação", async () => {
            const before = await prisma.usuario.update({ where: { id: context.userId }, data: { senha: null } });
            const response = await context.resetPassword(recoveryToken);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("A senha ainda não foi definida");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } })).toEqual(before);
        });

        test("Link utilizado não pode redefinir a senha novamente", async () => {
            expect((await context.resetPassword(recoveryToken)).statusCode).toBe(200);
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } });
            const response = await context.resetPassword(recoveryToken);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Link de recuperação inválido ou expirado");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } })).toEqual(before);
            expect(await prisma.logs.count({ where: { user_id: context.userId, action: "REDEFINICAO_SENHA" } })).toBe(1);
        });

        test("Redefinição rejeita dados ausentes, token inválido, senha curta, confirmação diferente e campos extras", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } });
            const valid = { token: recoveryToken, password: context.newPassword, confirmPassword: context.newPassword };
            const invalidBodies = [
                {},
                { token: recoveryToken, password: context.newPassword },
                { token: recoveryToken, confirmPassword: context.newPassword },
                { ...valid, token: "invalido" },
                { ...valid, token: "g".repeat(64) },
                { ...valid, token: recoveryToken + "\n" },
                { ...valid, password: "1234567", confirmPassword: "1234567" },
                { ...valid, password: "        ", confirmPassword: "        " },
                { ...valid, password: "á".repeat(37), confirmPassword: "á".repeat(37) },
                { ...valid, confirmPassword: "OutraSenha123!" },
                { ...valid, role: "Admin" }
            ];
            for (const payload of invalidBodies) {
                const response = await app.inject({ method: "POST", url: "/auth/reset-password", payload });
                expect(response.statusCode).toBe(400);
                expect(response.json().message).toBe("Dados inválidos");
                expect(response.json().errors).toEqual(expect.any(Array));
            }
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } })).toEqual(before);
            expect(await prisma.logs.count({ where: { user_id: context.userId, action: "REDEFINICAO_SENHA" } })).toBe(0);
        });

        test("Senha com exatamente 72 bytes é aceita", async () => {
            const unicodePassword = "á".repeat(36);
            const response = await app.inject({
                method: "POST", url: "/auth/reset-password",
                payload: { token: recoveryToken, password: unicodePassword, confirmPassword: unicodePassword }
            });
            expect(response.statusCode).toBe(200);
            const user = await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } });
            assert.ok(user.senha);
            expect(await bcrypt.compare(unicodePassword, user.senha)).toBe(true);
        });

        test("Token de convite não pode redefinir uma senha existente", async () => {
            const invitation = generateInvitation("http://localhost:5173");
            const before = await prisma.usuario.update({
                where: { id: context.userId },
                data: { invitation_token_hash: invitation.tokenHash, invitation_expires_at: invitation.expiresAt }
            });
            const response = await context.resetPassword(invitation.token);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Link de recuperação inválido ou expirado");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } })).toEqual(before);
        });

        test("Token de recuperação não pode ser usado na rota de primeira senha", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } });
            const response = await app.inject({
                method: "POST", url: "/auth/new-password",
                payload: { token: recoveryToken, password: context.newPassword, confirmPassword: context.newPassword }
            });
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Convite inválido ou expirado");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } })).toEqual(before);
        });

        test("Falha no log desfaz a nova senha e preserva o link para tentar novamente", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } });
            jest.mocked(createLogService).mockRejectedValueOnce(new Error("Falha ao salvar log"));
            const response = await context.resetPassword(recoveryToken);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Falha ao salvar log");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } })).toEqual(before);
            expect(await prisma.logs.count({ where: { user_id: context.userId, action: "REDEFINICAO_SENHA" } })).toBe(0);
            expect((await context.resetPassword(recoveryToken)).statusCode).toBe(200);
        });

        test("Duas redefinições simultâneas usam o link somente uma vez", async () => {
            const responses = await Promise.all([context.resetPassword(recoveryToken), context.resetPassword(recoveryToken)]);
            expect(responses.filter((response) => response.statusCode === 200)).toHaveLength(1);
            expect(responses.filter((response) => response.statusCode === 400)).toHaveLength(1);
            const user = await prisma.usuario.findUniqueOrThrow({ where: { id: context.userId } });
            expect(user.password_reset_token_hash).toBeNull();
            expect(user.password_reset_expires_at).toBeNull();
            expect(await prisma.logs.count({ where: { user_id: context.userId, action: "REDEFINICAO_SENHA" } })).toBe(1);
        });
    });
});
