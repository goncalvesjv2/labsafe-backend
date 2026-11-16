/// <reference types="jest" />
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { app } from "../../app";
import { prisma } from "../../database/prisma";
import { user_role } from "../../generated/prisma/enums";
import { sendEmailService } from "../../services/emailService";
import { createLogService } from "../../services/logService";
import { generatePasswordReset } from "../../utils/passwordReset";
import { generateInvitation } from "../../utils/invitation";

jest.mock("../../services/emailService", () => ({
    sendEmailService: jest.fn().mockResolvedValue({ messageId: "email-teste" })
}));

jest.mock("../../services/logService", () => {
    const original = jest.requireActual<typeof import("../../services/logService")>("../../services/logService");
    return { ...original, createLogService: jest.fn(original.createLogService) };
});

const originalCreateLogService = jest.requireActual<typeof import("../../services/logService")>("../../services/logService").createLogService;

describe("Recuperação de senha", () => {
    const password = "SenhaTeste123!";
    const newPassword = "NovaSenha123!";
    const genericResponse = {
        message: "Se houver uma conta apta à recuperação com esse e-mail, você receberá as instruções."
    };
    let passwordHash: string;
    let userId: number;
    let email: string;

    beforeAll(async () => {
        app.log.level = "silent";
        await app.ready();
        passwordHash = await bcrypt.hash(password, 10);
    }, 30000);

    beforeEach(async () => {
        jest.mocked(sendEmailService).mockReset();
        jest.mocked(sendEmailService).mockResolvedValue({ messageId: "email-teste" });
        jest.mocked(createLogService).mockReset();
        jest.mocked(createLogService).mockImplementation(originalCreateLogService);

        email = `recuperacao.${randomUUID()}@example.com`;
        const user = await prisma.usuario.create({
            data: { name: "Aluno Recuperação", email, senha: passwordHash, role: user_role.Aluno_a_ }
        });
        userId = user.id;
    });

    afterAll(async () => {
        await Promise.all([app.close(), prisma.$disconnect()]);
    }, 30000);

    async function requestRecovery(value = email) {
        return app.inject({ method: "POST", url: "/auth/forgot-password", payload: { email: value } });
    }

    async function resetPassword(token: string) {
        return app.inject({
            method: "POST", url: "/auth/reset-password",
            payload: { token, password: newPassword, confirmPassword: newPassword }
        });
    }

    function getEmailToken(index = 0) {
        const sentEmail = jest.mocked(sendEmailService).mock.calls[index][0];
        const link = sentEmail.text.match(/http:\/\/localhost:5173\/reset-password\?type=recovery&token=[a-f0-9]{64}/);
        assert.ok(link);
        const token = new URL(link[0]).searchParams.get("token");
        assert.ok(token);
        return token;
    }

    describe("Solicitação do link", () => {
        test("Conta ativa recebe o link e salva somente o hash com validade de 5 minutos", async () => {
            let savedBeforeEmail = false;
            jest.mocked(sendEmailService).mockImplementationOnce(async () => {
                const user = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
                savedBeforeEmail = user.password_reset_token_hash !== null;
                return { messageId: "email-teste" };
            });

            const before = Date.now();
            const response = await requestRecovery(`  ${email.toUpperCase()}  `);
            const after = Date.now();
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual(genericResponse);
            expect(sendEmailService).toHaveBeenCalledTimes(1);
            expect(savedBeforeEmail).toBe(true);
            const sentEmail = jest.mocked(sendEmailService).mock.calls[0][0];
            expect(sentEmail.to).toBe(email);
            expect(sentEmail.text).toContain("5 minutos");

            const token = getEmailToken();
            const user = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
            expect(user.password_reset_token_hash).toBe(createHash("sha256").update(token).digest("hex"));
            expect(user.password_reset_token_hash).not.toBe(token);
            expect(user.senha).toBe(passwordHash);
            assert.ok(user.password_reset_expires_at);
            expect(user.password_reset_expires_at.getTime()).toBeGreaterThanOrEqual(before + 300000);
            expect(user.password_reset_expires_at.getTime()).toBeLessThanOrEqual(after + 300000);
        });

        test("E-mail não cadastrado recebe a mensagem genérica sem enviar e-mail", async () => {
            const response = await requestRecovery(`inexistente.${randomUUID()}@example.com`);
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual(genericResponse);
            expect(sendEmailService).not.toHaveBeenCalled();
        });

        test("Conta inativa não recebe link nem sofre alterações", async () => {
            const before = await prisma.usuario.update({ where: { id: userId }, data: { ativo: false } });
            const response = await requestRecovery();
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual(genericResponse);
            expect(sendEmailService).not.toHaveBeenCalled();
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
        });

        test("Conta sem senha definida não recebe link de recuperação", async () => {
            const before = await prisma.usuario.update({ where: { id: userId }, data: { senha: null } });
            const response = await requestRecovery();
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual(genericResponse);
            expect(sendEmailService).not.toHaveBeenCalled();
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
        });

        test("Solicitação rejeita e-mail ausente, inválido e campos extras", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
            const invalidBodies = [{}, { email: "invalido" }, { email: 123 }, { email: "   " }, { email, role: "Admin" }];
            for (const payload of invalidBodies) {
                const response = await app.inject({ method: "POST", url: "/auth/forgot-password", payload });
                expect(response.statusCode).toBe(400);
                expect(response.json().message).toBe("Dados inválidos");
                expect(response.json().errors).toEqual(expect.any(Array));
            }
            expect(sendEmailService).not.toHaveBeenCalled();
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
        });

        test("Nova solicitação substitui o link anterior e renova a validade", async () => {
            expect((await requestRecovery()).statusCode).toBe(200);
            const firstToken = getEmailToken();
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
            expect((await requestRecovery()).statusCode).toBe(200);
            const secondToken = getEmailToken(1);
            expect(secondToken).not.toBe(firstToken);
            const after = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
            expect(after.password_reset_token_hash).toBe(createHash("sha256").update(secondToken).digest("hex"));
            assert.ok(before.password_reset_expires_at);
            assert.ok(after.password_reset_expires_at);
            expect(after.password_reset_expires_at.getTime()).toBeGreaterThanOrEqual(before.password_reset_expires_at.getTime());
            expect(after.senha).toBe(passwordHash);
            expect((await resetPassword(firstToken)).statusCode).toBe(400);
            expect((await resetPassword(secondToken)).statusCode).toBe(200);
        });

        test("Falha no envio mantém a senha atual e a mesma resposta genérica", async () => {
            jest.mocked(sendEmailService).mockRejectedValueOnce(new Error("Falha no SMTP"));
            const response = await requestRecovery();
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual(genericResponse);
            const user = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
            expect(user.senha).toBe(passwordHash);
            expect(user.password_reset_token_hash).not.toBeNull();
            expect(user.password_reset_expires_at).not.toBeNull();

            expect((await requestRecovery()).statusCode).toBe(200);
            expect(sendEmailService).toHaveBeenCalledTimes(2);
            expect((await resetPassword(getEmailToken(1))).statusCode).toBe(200);
        });
    });

    describe("Redefinição da senha", () => {
        let recoveryToken: string;

        beforeEach(async () => {
            const recovery = generatePasswordReset("http://localhost:5173");
            recoveryToken = recovery.token;
            await prisma.usuario.update({
                where: { id: userId },
                data: { password_reset_token_hash: recovery.tokenHash, password_reset_expires_at: recovery.expiresAt }
            });
        });

        test("Link válido salva a senha com bcrypt, apaga a recuperação e registra o log", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
            const response = await app.inject({
                method: "POST", url: "/auth/reset-password",
                payload: { token: recoveryToken, password: `  ${newPassword}  `, confirmPassword: newPassword }
            });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ message: "Senha redefinida com sucesso. Faça login para acessar o sistema." });
            const user = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
            assert.ok(user.senha);
            expect(user.senha).not.toBe(newPassword);
            expect(user.senha).not.toBe(passwordHash);
            expect(await bcrypt.compare(newPassword, user.senha)).toBe(true);
            expect(user).toEqual({ ...before, senha: user.senha, password_reset_token_hash: null, password_reset_expires_at: null });
            expect(await prisma.logs.count({ where: { user_id: userId, action: "REDEFINICAO_SENHA" } })).toBe(1);
        });

        test("Usuário solicita o e-mail, redefine a senha e faz login somente com a senha nova", async () => {
            expect((await requestRecovery()).statusCode).toBe(200);
            expect((await resetPassword(getEmailToken())).statusCode).toBe(200);
            const oldLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
            expect(oldLogin.statusCode).toBe(401);
            const newLogin = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: newPassword } });
            expect(newLogin.statusCode).toBe(200);
            expect(newLogin.json().token).toEqual(expect.any(String));
        });

        test("Redefinir a senha não altera outra conta", async () => {
            const recovery = generatePasswordReset("http://localhost:5173");
            const otherUser = await prisma.usuario.create({
                data: {
                    name: "Outro Aluno", email: `outra.recuperacao.${randomUUID()}@example.com`,
                    senha: passwordHash, role: user_role.Aluno_a_,
                    password_reset_token_hash: recovery.tokenHash,
                    password_reset_expires_at: recovery.expiresAt
                }
            });
            expect((await resetPassword(recoveryToken)).statusCode).toBe(200);
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: otherUser.id } })).toEqual(otherUser);
        });

        test("Token inexistente não altera a senha", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
            const response = await resetPassword("0".repeat(64));
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Link de recuperação inválido ou expirado");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
        });

        test("Link expirado não altera a senha", async () => {
            const before = await prisma.usuario.update({ where: { id: userId }, data: { password_reset_expires_at: new Date(Date.now() - 1000) } });
            const response = await resetPassword(recoveryToken);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Link de recuperação inválido ou expirado");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
        });

        test("Link sem data de expiração não altera a senha", async () => {
            const before = await prisma.usuario.update({ where: { id: userId }, data: { password_reset_expires_at: null } });
            const response = await resetPassword(recoveryToken);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Link de recuperação inválido ou expirado");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
        });

        test("Conta inativa não pode redefinir a senha", async () => {
            const before = await prisma.usuario.update({ where: { id: userId }, data: { ativo: false } });
            const response = await resetPassword(recoveryToken);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Usuário inativo");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
        });

        test("Conta sem senha definida não pode usar a recuperação", async () => {
            const before = await prisma.usuario.update({ where: { id: userId }, data: { senha: null } });
            const response = await resetPassword(recoveryToken);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("A senha ainda não foi definida");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
        });

        test("Link utilizado não pode redefinir a senha novamente", async () => {
            expect((await resetPassword(recoveryToken)).statusCode).toBe(200);
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
            const response = await resetPassword(recoveryToken);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Link de recuperação inválido ou expirado");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
            expect(await prisma.logs.count({ where: { user_id: userId, action: "REDEFINICAO_SENHA" } })).toBe(1);
        });

        test("Redefinição rejeita dados ausentes, token inválido, senha curta, confirmação diferente e campos extras", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
            const valid = { token: recoveryToken, password: newPassword, confirmPassword: newPassword };
            const invalidBodies = [
                {},
                { token: recoveryToken, password: newPassword },
                { token: recoveryToken, confirmPassword: newPassword },
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
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
            expect(await prisma.logs.count({ where: { user_id: userId, action: "REDEFINICAO_SENHA" } })).toBe(0);
        });

        test("Senha com exatamente 72 bytes é aceita", async () => {
            const unicodePassword = "á".repeat(36);
            const response = await app.inject({
                method: "POST", url: "/auth/reset-password",
                payload: { token: recoveryToken, password: unicodePassword, confirmPassword: unicodePassword }
            });
            expect(response.statusCode).toBe(200);
            const user = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
            assert.ok(user.senha);
            expect(await bcrypt.compare(unicodePassword, user.senha)).toBe(true);
        });

        test("Token de convite não pode redefinir uma senha existente", async () => {
            const invitation = generateInvitation("http://localhost:5173");
            const before = await prisma.usuario.update({
                where: { id: userId },
                data: { invitation_token_hash: invitation.tokenHash, invitation_expires_at: invitation.expiresAt }
            });
            const response = await resetPassword(invitation.token);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Link de recuperação inválido ou expirado");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
        });

        test("Token de recuperação não pode ser usado na rota de primeira senha", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
            const response = await app.inject({
                method: "POST", url: "/auth/new-password",
                payload: { token: recoveryToken, password: newPassword, confirmPassword: newPassword }
            });
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Convite inválido ou expirado");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
        });

        test("Falha no log desfaz a nova senha e preserva o link para tentar novamente", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
            jest.mocked(createLogService).mockRejectedValueOnce(new Error("Falha ao salvar log"));
            const response = await resetPassword(recoveryToken);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Falha ao salvar log");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: userId } })).toEqual(before);
            expect(await prisma.logs.count({ where: { user_id: userId, action: "REDEFINICAO_SENHA" } })).toBe(0);
            expect((await resetPassword(recoveryToken)).statusCode).toBe(200);
        });

        test("Duas redefinições simultâneas usam o link somente uma vez", async () => {
            const responses = await Promise.all([resetPassword(recoveryToken), resetPassword(recoveryToken)]);
            expect(responses.filter((response) => response.statusCode === 200)).toHaveLength(1);
            expect(responses.filter((response) => response.statusCode === 400)).toHaveLength(1);
            const user = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
            expect(user.password_reset_token_hash).toBeNull();
            expect(user.password_reset_expires_at).toBeNull();
            expect(await prisma.logs.count({ where: { user_id: userId, action: "REDEFINICAO_SENHA" } })).toBe(1);
        });
    });
});
