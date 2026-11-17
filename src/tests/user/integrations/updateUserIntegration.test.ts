import { setupUserAccessIntegration } from "./helpers/setupUserAccessIntegration";
import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { user_role } from "../../../generated/prisma/enums";
import { UserRole } from "../../../utils/user";
import { createLogService } from "../../../services/logService";
import { sendEmailService } from "../../../services/emailService";
import { generateInvitation } from "../../../utils/invitation";
import { generatePasswordReset } from "../../../utils/passwordReset";
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

    test("deve atualizar um usuário salvando o e-mail em minúsculas e sem espaços nas extremidades", async () => {
        const user = { name: "Aluno Antes", email: context.updateEmail, role: UserRole.ALUNO };

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

        const updatedUser = { name: "Aluno Atualizado", email: `  ${context.updateEmail.toUpperCase()}  `, role: UserRole.ALUNO };
        const response = await app.inject({
            method: "PATCH",
            url: `/api/users/${createdUser.id}`,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${context.token}`
            },
            payload: updatedUser
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toMatchObject({
            id: createdUser.id,
            name: updatedUser.name,
            email: context.updateEmail,
            role: updatedUser.role
        });
        expect(body).not.toHaveProperty("senha");
        expect(body).not.toHaveProperty("password");
        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { id: createdUser.id } });
        expect(savedUser.name).toBe(updatedUser.name);
        expect(savedUser.email).toBe(context.updateEmail);
    }, 30000);

    test("deve retornar erro ao atualizar um usuário inexistente sem registrar sucesso", async () => {
        const user = await prisma.usuario.create({
            data: { name: "Usuário temporário", email: context.missingUpdateEmail, senha: "hash-de-teste", role: user_role.Aluno_a_ }
        });
        await prisma.usuario.delete({ where: { id: user.id } });

        const response = await app.inject({
            method: "PATCH",
            url: `/api/users/${user.id}`,
            headers: { authorization: `Bearer ${context.token}` },
            payload: { name: "Novo nome", email: context.missingUpdateEmail, role: UserRole.ALUNO }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Usuário não encontrado");
        expect(await prisma.usuario.findUnique({ where: { id: user.id } })).toBeNull();
        expect(await prisma.logs.count({
            where: { user_id: context.adminId, action: "ALTERACAO_USUARIO", description: { contains: context.missingUpdateEmail } }
        })).toBe(0);
    }, 30000);

    describe("Cargo, status e acesso", () => {
        const access = setupUserAccessIntegration(context);

        test("Admin não pode alterar o próprio cargo", async () => {
            for (const role of [UserRole.ALUNO, UserRole.PROFESSOR]) {
                const response = await app.inject({
                    method: "PATCH", url: `/api/users/${access.admin.id}`,
                    headers: { authorization: `Bearer ${access.adminToken}` },
                    payload: { name: "Outro nome", email: access.admin.email, role }
                });

                expect(response.statusCode).toBe(400);
                expect(response.json().message).toBe("Você não pode editar sua própria conta");
                expect(await prisma.usuario.findUniqueOrThrow({ where: { id: access.admin.id } })).toEqual(access.admin);
                expect(await prisma.logs.count({ where: { user_id: access.admin.id, action: "ALTERACAO_USUARIO" } })).toBe(0);
            }
        });

        test("Admin não pode editar nome e e-mail da própria conta mesmo mantendo o cargo", async () => {
            const newEmail = `novo.${randomUUID()}@example.com`;
            const response = await app.inject({
                method: "PATCH", url: `/api/users/${access.admin.id}`,
                headers: { authorization: `Bearer ${access.adminToken}` },
                payload: { name: "Admin Atualizado", email: newEmail, role: UserRole.ADMIN }
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Você não pode editar sua própria conta");
            const savedAdmin = await prisma.usuario.findUniqueOrThrow({ where: { id: access.admin.id } });
            expect(savedAdmin).toEqual(access.admin);
            expect(await prisma.logs.count({ where: { user_id: access.admin.id, action: "ALTERACAO_USUARIO" } })).toBe(0);
        });

        test("Admin pode alterar o cargo de outro usuário", async () => {
            const response = await app.inject({
                method: "PATCH", url: `/api/users/${access.user.id}`,
                headers: { authorization: `Bearer ${access.adminToken}` },
                payload: { name: access.user.name, email: access.user.email, role: UserRole.PROFESSOR }
            });
            expect(response.statusCode).toBe(200);
            expect((await prisma.usuario.findUniqueOrThrow({ where: { id: access.user.id } })).role).toBe(user_role.Professor_a_);
            const logs = await prisma.logs.findMany({ where: { user_id: access.admin.id, action: "ALTERACAO_USUARIO" } });
            expect(logs).toHaveLength(1);
            expect(logs[0].description).toContain(access.user.email);
        });

        test("Alterar o e-mail invalida o convite antigo e permite reenviar para o novo endereço", async () => {
            const invitation = generateInvitation("http://localhost:5173");
            await prisma.usuario.update({
                where: { id: access.user.id },
                data: { senha: null, invitation_token_hash: invitation.tokenHash, invitation_expires_at: invitation.expiresAt }
            });
            const newEmail = `novo.convite.${randomUUID()}@example.com`;

            const response = await app.inject({
                method: "PATCH", url: `/api/users/${access.user.id}`,
                headers: { authorization: `Bearer ${access.adminToken}` },
                payload: { name: access.user.name, email: newEmail, role: UserRole.ALUNO }
            });
            expect(response.statusCode).toBe(200);
            const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { id: access.user.id } });
            expect(savedUser.email).toBe(newEmail);
            expect(savedUser.invitation_token_hash).toBeNull();
            expect(savedUser.invitation_expires_at).toBeNull();
            expect(savedUser.senha).toBeNull();

            const accept = await app.inject({
                method: "POST", url: "/auth/new-password",
                payload: { token: invitation.token, password: context.password, confirmPassword: context.password }
            });
            expect(accept.statusCode).toBe(400);
            expect(accept.json().message).toBe("Convite inválido ou expirado");

            const resend = await app.inject({
                method: "POST", url: `/api/users/${access.user.id}/invitations/resend`,
                headers: { authorization: `Bearer ${access.adminToken}` }
            });
            expect(resend.statusCode).toBe(200);
            expect(resend.json().invitationSent).toBe(true);
            expect(sendEmailService).toHaveBeenLastCalledWith(expect.objectContaining({ to: newEmail }));
        });

        test("Alterar o e-mail invalida a recuperação antiga e permite solicitar pelo novo endereço", async () => {
            const recovery = generatePasswordReset("http://localhost:5173");
            await prisma.usuario.update({
                where: { id: access.user.id },
                data: { password_reset_token_hash: recovery.tokenHash, password_reset_expires_at: recovery.expiresAt }
            });
            const newEmail = `nova.recuperacao.${randomUUID()}@example.com`;

            const response = await app.inject({
                method: "PATCH", url: `/api/users/${access.user.id}`,
                headers: { authorization: `Bearer ${access.adminToken}` },
                payload: { name: access.user.name, email: newEmail, role: UserRole.ALUNO }
            });
            expect(response.statusCode).toBe(200);
            const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { id: access.user.id } });
            expect(savedUser.email).toBe(newEmail);
            expect(savedUser.password_reset_token_hash).toBeNull();
            expect(savedUser.password_reset_expires_at).toBeNull();
            expect(savedUser.senha).toBe(access.user.senha);

            const reset = await app.inject({
                method: "POST", url: "/auth/reset-password",
                payload: { token: recovery.token, password: "NovaSenha123!", confirmPassword: "NovaSenha123!" }
            });
            expect(reset.statusCode).toBe(400);
            expect(reset.json().message).toBe("Link de recuperação inválido ou expirado");

            const forgot = await app.inject({ method: "POST", url: "/auth/forgot-password", payload: { email: newEmail } });
            expect(forgot.statusCode).toBe(200);
            expect(sendEmailService).toHaveBeenLastCalledWith(expect.objectContaining({ to: newEmail }));
            const afterRecovery = await prisma.usuario.findUniqueOrThrow({ where: { id: access.user.id } });
            expect(afterRecovery.password_reset_token_hash).not.toBeNull();
            expect(afterRecovery.password_reset_token_hash).not.toBe(recovery.tokenHash);
            expect(afterRecovery.senha).toBe(access.user.senha);
        });

        test("Editar nome e cargo mantendo o mesmo e-mail preserva os links", async () => {
            const invitation = generateInvitation("http://localhost:5173");
            const recovery = generatePasswordReset("http://localhost:5173");
            const links = {
                invitation_token_hash: invitation.tokenHash,
                invitation_expires_at: invitation.expiresAt,
                password_reset_token_hash: recovery.tokenHash,
                password_reset_expires_at: recovery.expiresAt
            };
            await prisma.usuario.update({ where: { id: access.user.id }, data: links });

            const response = await app.inject({
                method: "PATCH", url: `/api/users/${access.user.id}`,
                headers: { authorization: `Bearer ${access.adminToken}` },
                payload: { name: "Nome Atualizado", email: `  ${access.user.email.toUpperCase()}  `, role: UserRole.PROFESSOR }
            });
            expect(response.statusCode).toBe(200);
            const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { id: access.user.id } });
            expect(savedUser).toEqual(expect.objectContaining({
                ...links, name: "Nome Atualizado", email: access.user.email, role: user_role.Professor_a_, senha: access.user.senha
            }));
        });

        test("Tentar usar um e-mail já cadastrado preserva os dados e os links", async () => {
            const invitation = generateInvitation("http://localhost:5173");
            const recovery = generatePasswordReset("http://localhost:5173");
            const before = await prisma.usuario.update({
                where: { id: access.user.id },
                data: {
                    invitation_token_hash: invitation.tokenHash, invitation_expires_at: invitation.expiresAt,
                    password_reset_token_hash: recovery.tokenHash, password_reset_expires_at: recovery.expiresAt
                }
            });

            const response = await app.inject({
                method: "PATCH", url: `/api/users/${access.user.id}`,
                headers: { authorization: `Bearer ${access.adminToken}` },
                payload: { name: "Outro Nome", email: access.admin.email, role: UserRole.PROFESSOR }
            });
            expect(response.statusCode).toBe(400);
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: access.user.id } })).toEqual(before);
            expect(await prisma.logs.count({ where: { user_id: access.admin.id, action: "ALTERACAO_USUARIO" } })).toBe(0);
        });

        test("Falha após gravar o log desfaz a edição, a invalidação dos links e o log", async () => {
            const invitation = generateInvitation("http://localhost:5173");
            const recovery = generatePasswordReset("http://localhost:5173");
            const before = await prisma.usuario.update({
                where: { id: access.user.id },
                data: {
                    invitation_token_hash: invitation.tokenHash, invitation_expires_at: invitation.expiresAt,
                    password_reset_token_hash: recovery.tokenHash, password_reset_expires_at: recovery.expiresAt
                }
            });
            const updatedUser = { name: "Aluno Atualizado", email: `edicao.${randomUUID()}@example.com`, role: UserRole.PROFESSOR };
            jest.mocked(createLogService).mockImplementationOnce(async (log, transaction) => {
                await originalCreateLogService(log, transaction);
                throw new Error("Falha ao concluir o log");
            });

            const response = await app.inject({
                method: "PATCH", url: `/api/users/${access.user.id}`,
                headers: { authorization: `Bearer ${access.adminToken}` }, payload: updatedUser
            });
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Falha ao concluir o log");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: access.user.id } })).toEqual(before);
            expect(await prisma.logs.count({ where: { user_id: access.admin.id, action: "ALTERACAO_USUARIO" } })).toBe(0);

            const retry = await app.inject({
                method: "PATCH", url: `/api/users/${access.user.id}`,
                headers: { authorization: `Bearer ${access.adminToken}` }, payload: updatedUser
            });
            expect(retry.statusCode).toBe(200);
            const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { id: access.user.id } });
            expect(savedUser.name).toBe(updatedUser.name);
            expect(savedUser.email).toBe(updatedUser.email);
            expect(savedUser.role).toBe(user_role.Professor_a_);
            expect(savedUser.senha).toBe(access.user.senha);
            expect(savedUser.invitation_token_hash).toBeNull();
            expect(savedUser.invitation_expires_at).toBeNull();
            expect(savedUser.password_reset_token_hash).toBeNull();
            expect(savedUser.password_reset_expires_at).toBeNull();
            expect(await prisma.logs.count({ where: { user_id: access.admin.id, action: "ALTERACAO_USUARIO" } })).toBe(1);
        });
    });
});
