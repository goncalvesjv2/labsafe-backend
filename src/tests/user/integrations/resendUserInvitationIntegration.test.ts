import "dotenv/config";
import { beforeEach, describe, expect, test } from "@jest/globals";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { user_role } from "../../../generated/prisma/enums";
import { UserRole } from "../../../utils/user";
import { createLogService } from "../../../services/logService";
import { sendEmailService } from "../../../services/emailService";
import { generateInvitation } from "../../../utils/invitation";
import { setupUserIntegration } from "./helpers/setupUserIntegration";

jest.mock("../../../services/emailService", () => ({
    sendEmailService: jest.fn().mockResolvedValue({ messageId: "email-teste" })
}));

jest.mock("../../../services/logService", () => {
    const original = jest.requireActual<typeof import("../../../services/logService")>("../../../services/logService");
    return { ...original, createLogService: jest.fn(original.createLogService) };
});

const originalCreateLogService = jest.requireActual<typeof import("../../../services/logService")>("../../../services/logService").createLogService;

describe("Teste de integração de usuários", () => {
    const context = setupUserIntegration();

    describe("Reenvio do convite", () => {
        let invitedUserId: number;
        let oldToken: string;

        beforeEach(async () => {
            jest.mocked(createLogService).mockReset();
            jest.mocked(createLogService).mockImplementation(originalCreateLogService);
            jest.mocked(sendEmailService).mockReset();
            jest.mocked(sendEmailService).mockResolvedValue({ messageId: "email-teste" });

            const invitation = generateInvitation("http://localhost:5173");
            oldToken = invitation.token;
            const user = await prisma.usuario.create({
                data: {
                    name: "Aluno Convidado",
                    email: `reenvio.${randomUUID()}@example.com`,
                    role: user_role.Aluno_a_,
                    senha: null,
                    invitation_token_hash: invitation.tokenHash,
                    invitation_expires_at: invitation.expiresAt
                }
            });
            invitedUserId = user.id;
        });

        async function resendInvitation() {
            return app.inject({
                method: "POST", url: `/api/users/${invitedUserId}/invitations/resend`,
                headers: { authorization: `Bearer ${context.token}` }
            });
        }

        test("Admin reenvia convite expirado e o usuário cria a senha pelo novo link", async () => {
            await prisma.usuario.update({ where: { id: invitedUserId }, data: { invitation_expires_at: new Date(Date.now() - 1000) } });
            let savedBeforeEmail = false;
            jest.mocked(sendEmailService).mockImplementationOnce(async () => {
                const saved = await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } });
                savedBeforeEmail = saved.invitation_token_hash !== createHash("sha256").update(oldToken).digest("hex");
                return { messageId: "email-teste" };
            });

            const before = Date.now();
            const response = await resendInvitation();
            const after = Date.now();
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ invitationSent: true, message: "Convite reenviado com sucesso." });
            expect(savedBeforeEmail).toBe(true);
            expect(sendEmailService).toHaveBeenCalledTimes(1);

            const saved = await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } });
            const email = jest.mocked(sendEmailService).mock.calls[0][0];
            expect(email.to).toBe(saved.email);
            const link = email.text.match(/http:\/\/localhost:5173\/reset-password\?type=invitation&token=[a-f0-9]{64}/);
            assert.ok(link);
            const newToken = new URL(link[0]).searchParams.get("token");
            assert.ok(newToken);
            expect(saved.invitation_token_hash).toBe(createHash("sha256").update(newToken).digest("hex"));
            expect(saved.senha).toBeNull();
            assert.ok(saved.invitation_expires_at);
            expect(saved.invitation_expires_at.getTime()).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
            expect(saved.invitation_expires_at.getTime()).toBeLessThanOrEqual(after + 5 * 60 * 1000);
            expect(await prisma.logs.count({ where: { user_id: context.adminId, action: "REENVIO_CONVITE", description: { contains: saved.email } } })).toBe(1);

            const accept = await app.inject({
                method: "POST", url: "/auth/new-password",
                payload: { token: newToken, password: context.password, confirmPassword: context.password }
            });
            expect(accept.statusCode).toBe(200);
            const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email: saved.email, password: context.password } });
            expect(login.statusCode).toBe(200);
            expect(login.json().token).toEqual(expect.any(String));
        });

        test("Reenvio substitui um convite ainda válido e bloqueia o link anterior", async () => {
            expect((await resendInvitation()).statusCode).toBe(200);
            const response = await app.inject({
                method: "POST", url: "/auth/new-password",
                payload: { token: oldToken, password: context.password, confirmPassword: context.password }
            });
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Convite inválido ou expirado");
            expect((await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).senha).toBeNull();
        });

        test("Conta inativa não recebe novo convite", async () => {
            await prisma.usuario.update({ where: { id: invitedUserId }, data: { ativo: false } });
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } });
            const response = await resendInvitation();
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Usuário inativo");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).toEqual(before);
            expect(sendEmailService).not.toHaveBeenCalled();
        });

        test("Usuário com senha definida não recebe novo convite", async () => {
            await prisma.usuario.update({ where: { id: invitedUserId }, data: { senha: context.passwordHash } });
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } });
            const response = await resendInvitation();
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("O convite só pode ser reenviado para usuários ativos sem senha definida");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).toEqual(before);
            expect(sendEmailService).not.toHaveBeenCalled();
        });

        test("Usuário inexistente não recebe convite", async () => {
            await prisma.usuario.delete({ where: { id: invitedUserId } });
            const response = await resendInvitation();
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Usuário não encontrado");
            expect(sendEmailService).not.toHaveBeenCalled();
        });

        test("Reenvio exige autenticação", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } });
            const response = await app.inject({ method: "POST", url: `/api/users/${invitedUserId}/invitations/resend` });
            expect(response.statusCode).toBe(401);
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).toEqual(before);
            expect(sendEmailService).not.toHaveBeenCalled();
        });

        test("Aluno e professor não podem reenviar convites", async () => {
            for (const role of [user_role.Aluno_a_, user_role.Professor_a_]) {
                await prisma.usuario.update({ where: { id: invitedUserId }, data: { role } });
                const before = await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } });
                const userToken = app.jwt.sign({ sub: invitedUserId, role: UserRole.ADMIN });
                const response = await app.inject({
                    method: "POST", url: `/api/users/${invitedUserId}/invitations/resend`,
                    headers: { authorization: `Bearer ${userToken}` }
                });
                expect(response.statusCode).toBe(403);
                expect(await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).toEqual(before);
            }
            expect(sendEmailService).not.toHaveBeenCalled();
        });

        test("Reenvio rejeita ID inválido", async () => {
            for (const id of ["abc", "0", "-1", "1.5", "9007199254740992"]) {
                const response = await app.inject({
                    method: "POST", url: `/api/users/${id}/invitations/resend`,
                    headers: { authorization: `Bearer ${context.token}` }
                });
                expect(response.statusCode).toBe(400);
                expect(response.json().message).toBe("ID inválido");
            }
            expect(sendEmailService).not.toHaveBeenCalled();
        });

        test("Falha no log mantém o convite anterior e não envia e-mail", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } });
            jest.mocked(createLogService).mockRejectedValueOnce(new Error("Falha ao salvar log"));
            const response = await resendInvitation();
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Falha ao salvar log");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).toEqual(before);
            expect(await prisma.logs.count({ where: { user_id: context.adminId, action: "REENVIO_CONVITE", description: { contains: before.email } } })).toBe(0);
            expect(sendEmailService).not.toHaveBeenCalled();
        });

        test("Falha no e-mail mantém o novo convite salvo e permite tentar reenviar", async () => {
            jest.mocked(sendEmailService).mockRejectedValueOnce(new Error("Falha no SMTP"));
            const response = await resendInvitation();
            expect(response.statusCode).toBe(200);
            expect(response.json().invitationSent).toBe(false);
            expect(response.json().message).toContain("Será necessário reenviar o convite");
            const saved = await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } });
            expect(saved.senha).toBeNull();
            expect(saved.invitation_token_hash).not.toBe(createHash("sha256").update(oldToken).digest("hex"));
            expect(saved.invitation_expires_at).not.toBeNull();
            const retry = await resendInvitation();
            expect(retry.statusCode).toBe(200);
            expect(retry.json().invitationSent).toBe(true);
            expect(sendEmailService).toHaveBeenCalledTimes(2);
        });
    });
});
