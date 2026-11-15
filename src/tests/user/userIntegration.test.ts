/// <reference types="jest" />
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { app } from "../../app";
import { prisma } from "../../database/prisma";
import { user_role } from "../../generated/prisma/enums";
import { UserRole } from "../../utils/user";
import type { IUserFormat } from "../../interfaces/IUserFormat";
import { createLogService } from "../../services/logService";
import { sendEmailService } from "../../services/emailService";
import { acceptUserInvitationService } from "../../services/userService";
import { generateInvitation } from "../../utils/invitation";

jest.mock("../../services/emailService", () => ({
    sendEmailService: jest.fn().mockResolvedValue({ messageId: "email-teste" })
}));

jest.mock("../../services/logService", () => {
    const original = jest.requireActual<typeof import("../../services/logService")>("../../services/logService");
    return { ...original, createLogService: jest.fn(original.createLogService) };
});

const originalCreateLogService = jest.requireActual<typeof import("../../services/logService")>("../../services/logService").createLogService;

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

    test("deve criar um usuário salvando o e-mail em minúsculas e sem espaços nas extremidades", async () => {
        const user = { name: "Aluno Teste", email: `  ${email.toUpperCase()}  `, role: UserRole.ALUNO };
        let registrationCommitted = false;

        jest.mocked(sendEmailService).mockImplementationOnce(async () => {
            const savedUser = await prisma.usuario.findUnique({ where: { email } });
            registrationCommitted = savedUser?.invitation_token_hash != null;
            return { messageId: "email-teste" };
        });

        const before = Date.now();
        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
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
        expect(sentEmail.to).toBe(email);
        expect(sentEmail.text).toContain("5 minutos");
        const link = sentEmail.text.match(/http:\/\/localhost:5173\/reset-password\?type=invitation&token=[a-f0-9]{64}/);
        assert.ok(link);
        const invitationToken = new URL(link[0]).searchParams.get("token");
        assert.ok(invitationToken);
        expect(body).toMatchObject({ id: expect.any(Number), name: user.name, email, role: user.role });
        expect(body).not.toHaveProperty("senha");
        expect(body).not.toHaveProperty("password");
        expect(body).not.toHaveProperty("token");
        expect(body).not.toHaveProperty("tokenHash");
        expect(body).not.toHaveProperty("invitationUrl");
        expect(body).not.toHaveProperty("invitation_token_hash");
        expect(body).not.toHaveProperty("invitation_expires_at");
        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { email } });
        expect(savedUser).toMatchObject({ id: body.id, name: user.name, email, role: user_role.Aluno_a_ });
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
            headers: { authorization: `Bearer ${token}` },
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
            where: { user_id: adminId, action: "CADASTRO_USUARIO", description: { contains: failedEmail } }
        })).toBe(1);
    });

    test("Falha ao salvar o log desfaz o cadastro e o convite", async () => {
        const failedEmail = `cadastro.falha.${randomUUID()}@example.com`;
        jest.mocked(createLogService).mockRejectedValueOnce(new Error("Falha ao salvar log"));

        const response = await app.inject({
            method: "POST", url: "/api/users",
            headers: { authorization: `Bearer ${token}` },
            payload: { name: "Aluno Teste", email: failedEmail, role: UserRole.ALUNO }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Falha ao salvar log");
        expect(sendEmailService).not.toHaveBeenCalled();
        expect(await prisma.usuario.findUnique({ where: { email: failedEmail } })).toBeNull();
        expect(await prisma.logs.count({
            where: { user_id: adminId, action: "CADASTRO_USUARIO", description: { contains: failedEmail } }
        })).toBe(0);
    });

    test("deve listar usuários e encontrar o usuário cadastrado", async () => {
        const user = { name: "Aluno Listagem", email: listEmail, role: UserRole.ALUNO };

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
        const user = { name: "Aluno Consulta", email: idEmail, role: UserRole.ALUNO };
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
        const user = { name: "Aluno Antes", email: updateEmail, role: UserRole.ALUNO };

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
        const user = { name: "Aluno Exclusão", email: deleteEmail, role: UserRole.ALUNO };

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
        const user = { name: "Aluno Original", email: duplicateEmail, role: UserRole.ALUNO };
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
        const duplicateUser = { name: "Outro Aluno", email: `  ${duplicateEmail.toUpperCase()}  `, role: UserRole.ALUNO };
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
        const user = { name: "Aluno Inválido", email: invalidEmail, role: UserRole.ALUNO };

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
        const user = { name: "Aluno Temporário", email: missingEmail, role: UserRole.ALUNO };
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
                headers: { authorization: `Bearer ${token}` }
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
            expect(await prisma.logs.count({ where: { user_id: adminId, action: "REENVIO_CONVITE", description: { contains: saved.email } } })).toBe(1);

            const accept = await app.inject({
                method: "POST", url: "/auth/new-password",
                payload: { token: newToken, password, confirmPassword: password }
            });
            expect(accept.statusCode).toBe(200);
            const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email: saved.email, password } });
            expect(login.statusCode).toBe(200);
            expect(login.json().token).toEqual(expect.any(String));
        });

        test("Reenvio substitui um convite ainda válido e bloqueia o link anterior", async () => {
            expect((await resendInvitation()).statusCode).toBe(200);
            const response = await app.inject({
                method: "POST", url: "/auth/new-password",
                payload: { token: oldToken, password, confirmPassword: password }
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
            await prisma.usuario.update({ where: { id: invitedUserId }, data: { senha: passwordHash } });
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
                    headers: { authorization: `Bearer ${token}` }
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
            expect(await prisma.logs.count({ where: { user_id: adminId, action: "REENVIO_CONVITE", description: { contains: before.email } } })).toBe(0);
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

    describe("Aceite do convite", () => {
        let invitationToken: string;
        let invitedUserId: number;

        beforeEach(async () => {
            jest.mocked(createLogService).mockReset();
            jest.mocked(createLogService).mockImplementation(originalCreateLogService);

            const invitation = generateInvitation("http://localhost:5173");
            invitationToken = invitation.token;
            const user = await prisma.usuario.create({
                data: {
                    name: "Aluno Convidado",
                    email: `aceite.${randomUUID()}@example.com`,
                    role: user_role.Aluno_a_,
                    senha: null,
                    invitation_token_hash: invitation.tokenHash,
                    invitation_expires_at: invitation.expiresAt
                }
            });
            invitedUserId = user.id;
        });

        test("Convite válido salva a senha com bcrypt, apaga o convite e registra o log", async () => {
            const result = await acceptUserInvitationService(invitationToken, password);
            expect(result).toEqual({ message: "Senha criada com sucesso. Faça login para acessar o sistema." });

            const user = await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } });
            assert.ok(user.senha);
            expect(await bcrypt.compare(password, user.senha)).toBe(true);
            expect(user.invitation_token_hash).toBeNull();
            expect(user.invitation_expires_at).toBeNull();
            expect(await prisma.logs.count({ where: { user_id: invitedUserId, action: "ACEITE_CONVITE" } })).toBe(1);
        });

        test("Convite inexistente não permite definir a senha", async () => {
            await expect(acceptUserInvitationService("0".repeat(64), password)).rejects.toThrow("Convite inválido ou expirado");
            const user = await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } });
            expect(user.senha).toBeNull();
            expect(user.invitation_token_hash).not.toBeNull();
        });

        test("Convite expirado não permite definir a senha", async () => {
            await prisma.usuario.update({ where: { id: invitedUserId }, data: { invitation_expires_at: new Date(Date.now() - 1000) } });
            await expect(acceptUserInvitationService(invitationToken, password)).rejects.toThrow("Convite inválido ou expirado");
            expect((await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).senha).toBeNull();
        });

        test("Convite sem validade não permite definir a senha", async () => {
            await prisma.usuario.update({ where: { id: invitedUserId }, data: { invitation_expires_at: null } });
            await expect(acceptUserInvitationService(invitationToken, password)).rejects.toThrow("Convite inválido ou expirado");
            expect((await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).senha).toBeNull();
        });

        test("Conta inativa não permite aceitar o convite", async () => {
            await prisma.usuario.update({ where: { id: invitedUserId }, data: { ativo: false } });
            await expect(acceptUserInvitationService(invitationToken, password)).rejects.toThrow("Usuário inativo");
            expect((await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).senha).toBeNull();
        });

        test("Convite não altera uma senha que já foi definida", async () => {
            await prisma.usuario.update({ where: { id: invitedUserId }, data: { senha: passwordHash } });
            await expect(acceptUserInvitationService(invitationToken, "OutraSenha123!")).rejects.toThrow("A senha já foi definida");
            expect((await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).senha).toBe(passwordHash);
        });

        test("Convite usado não pode ser aceito novamente", async () => {
            await acceptUserInvitationService(invitationToken, password);
            await expect(acceptUserInvitationService(invitationToken, "OutraSenha123!")).rejects.toThrow("Convite inválido ou expirado");
            expect(await prisma.logs.count({ where: { user_id: invitedUserId, action: "ACEITE_CONVITE" } })).toBe(1);
        });

        test("Duas tentativas simultâneas só conseguem aceitar o convite uma vez", async () => {
            const results = await Promise.allSettled([
                acceptUserInvitationService(invitationToken, password),
                acceptUserInvitationService(invitationToken, password)
            ]);
            expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
            expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
            expect(await prisma.logs.count({ where: { user_id: invitedUserId, action: "ACEITE_CONVITE" } })).toBe(1);
        });

        test("Falha no log desfaz a senha e mantém o convite disponível", async () => {
            const before = await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } });
            jest.mocked(createLogService).mockRejectedValueOnce(new Error("Falha ao salvar log"));

            await expect(acceptUserInvitationService(invitationToken, password)).rejects.toThrow("Falha ao salvar log");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: invitedUserId } })).toEqual(before);
            expect(await prisma.logs.count({ where: { user_id: invitedUserId, action: "ACEITE_CONVITE" } })).toBe(0);
            await expect(acceptUserInvitationService(invitationToken, password)).resolves.toHaveProperty("message");
        });
    });

    describe("Cargo, status e acesso", () => {
        let admin: IUserFormat;
        let user: IUserFormat;
        let adminToken: string;

        beforeEach(async () => {
            jest.mocked(createLogService).mockReset();
            jest.mocked(createLogService).mockImplementation(originalCreateLogService);

            admin = await prisma.usuario.create({
                data: { name: "Admin Teste", email: `admin.status.${randomUUID()}@example.com`, senha: passwordHash, role: user_role.Admin }
            });

            user = await prisma.usuario.create({
                data: { name: "Aluno Teste", email: `aluno.status.${randomUUID()}@example.com`, senha: passwordHash, role: user_role.Aluno_a_ }
            });
            adminToken = app.jwt.sign({ sub: admin.id, role: UserRole.ADMIN });
        });

        async function changeStatus(ativo: boolean) {
            return app.inject({
                method: "PATCH", url: `/api/users/${user.id}/status`,
                headers: { authorization: `Bearer ${adminToken}` }, payload: { ativo }
            });
        }

        async function loginUser() {
            return app.inject({ method: "POST", url: "/auth/login", payload: { email: user.email, password } });
        }

        async function countStatusLogs() {
            return prisma.logs.count({ where: { user_id: admin.id, action: "ALTERACAO_STATUS_USUARIO" } });
        }

        test("Admin não pode alterar o próprio cargo", async () => {
            for (const role of [UserRole.ALUNO, UserRole.PROFESSOR]) {
                const response = await app.inject({
                    method: "PATCH", url: `/api/users/${admin.id}`,
                    headers: { authorization: `Bearer ${adminToken}` },
                    payload: { name: "Outro nome", email: admin.email, role }
                });

                expect(response.statusCode).toBe(400);
                expect(response.json().message).toBe("Você não pode alterar seu próprio cargo");
                expect(await prisma.usuario.findUniqueOrThrow({ where: { id: admin.id } })).toEqual(admin);
                expect(await prisma.logs.count({ where: { user_id: admin.id, action: "ALTERACAO_USUARIO" } })).toBe(0);
            }
        });

        test("Admin pode editar nome e e-mail mantendo a senha e o próprio cargo", async () => {
            const newEmail = `novo.${randomUUID()}@example.com`;
            const response = await app.inject({
                method: "PATCH", url: `/api/users/${admin.id}`,
                headers: { authorization: `Bearer ${adminToken}` },
                payload: { name: "Admin Atualizado", email: newEmail, role: UserRole.ADMIN }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).not.toHaveProperty("senha");
            const savedAdmin = await prisma.usuario.findUniqueOrThrow({ where: { id: admin.id } });
            expect(savedAdmin.name).toBe("Admin Atualizado");
            expect(savedAdmin.email).toBe(newEmail);
            expect(savedAdmin.role).toBe(user_role.Admin);
            expect(savedAdmin.senha).toBe(admin.senha);
        });

        test("Admin pode alterar o cargo de outro usuário", async () => {
            const response = await app.inject({
                method: "PATCH", url: `/api/users/${user.id}`,
                headers: { authorization: `Bearer ${adminToken}` },
                payload: { name: user.name, email: user.email, role: UserRole.PROFESSOR }
            });
            expect(response.statusCode).toBe(200);
            expect((await prisma.usuario.findUniqueOrThrow({ where: { id: user.id } })).role).toBe(user_role.Professor_a_);
        });

        test("Admin que virou aluno não pode acessar rota administrativa com o token antigo", async () => {
            const accessBefore = await app.inject({
                method: "GET",
                url: "/api/users",
                headers: { authorization: `Bearer ${adminToken}` }
            });
            expect(accessBefore.statusCode).toBe(200);

            // Outro admin altera o cargo de quem já está conectado.
            const changeRole = await app.inject({
                method: "PATCH",
                url: `/api/users/${admin.id}`,
                headers: { authorization: `Bearer ${token}` },
                payload: { name: admin.name, email: admin.email, role: UserRole.ALUNO }
            });
            expect(changeRole.statusCode).toBe(200);
            const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { id: admin.id } });
            expect(savedUser.role).toBe(user_role.Aluno_a_);

            const accessAfter = await app.inject({
                method: "GET",
                url: "/api/users",
                headers: { authorization: `Bearer ${adminToken}` }
            });
            expect(accessAfter.statusCode).toBe(403);
            expect(accessAfter.json().message).toBe("Acesso não autorizado");
        });

        test("Admin pode desativar outro usuário e registrar a alteração", async () => {
            const response = await changeStatus(false);
            expect(response.statusCode).toBe(200);
            expect(response.json().ativo).toBe(false);
            expect(response.json()).not.toHaveProperty("senha");
            expect(response.json()).not.toHaveProperty("password");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: user.id } })).toEqual({ ...user, ativo: false });
            const logs = await prisma.logs.findMany({ where: { user_id: admin.id, action: "ALTERACAO_STATUS_USUARIO" } });
            expect(logs).toHaveLength(1);
            expect(logs[0].description).toContain(user.email);
            expect(logs[0].description).toContain("desativado");
        });

        test("Usuário ativo pode fazer login com a senha correta", async () => {
            const response = await loginUser();
            expect(response.statusCode).toBe(200);
            expect(response.json().token).toEqual(expect.any(String));
            expect(await prisma.logs.count({ where: { user_id: user.id, action: "LOGIN" } })).toBe(1);
        });

        test("Usuário sem senha definida não pode fazer login", async () => {
            await prisma.usuario.update({ where: { id: user.id }, data: { senha: null } });
            const response = await loginUser();
            expect(response.statusCode).toBe(401);
            expect(response.json().message).toBe("E-mail ou senha inválidos");
            expect(response.json()).not.toHaveProperty("token");
            expect(await prisma.logs.count({ where: { user_id: user.id, action: "LOGIN" } })).toBe(0);
        });

        test("Usuário ativo não pode fazer login com a senha incorreta", async () => {
            const response = await app.inject({
                method: "POST", url: "/auth/login", payload: { email: user.email, password: "SenhaIncorreta!" }
            });

            expect(response.statusCode).toBe(401);
            expect(response.json()).not.toHaveProperty("token");
            expect(await prisma.logs.count({ where: { user_id: user.id, action: "LOGIN" } })).toBe(0);
        });

        test("Usuário desativado não pode fazer login mesmo com a senha correta", async () => {
            expect((await changeStatus(false)).statusCode).toBe(200);
            const response = await loginUser();
            expect(response.statusCode).toBe(401);
            expect(response.json().message).toBe("E-mail ou senha inválidos");
            expect(response.json()).not.toHaveProperty("token");
            expect(await prisma.logs.count({ where: { user_id: user.id, action: "LOGIN" } })).toBe(0);
        });

        test("Usuário já autenticado perde o acesso quando sua conta é desativada", async () => {
            const login = await loginUser();
            expect(login.statusCode).toBe(200);
            const userToken = login.json().token;
            const before = await app.inject({
                method: "GET", url: "/auth/me", headers: { authorization: `Bearer ${userToken}` }
            });
            expect(before.statusCode).toBe(200);
            expect((await changeStatus(false)).statusCode).toBe(200);
            expect(app.jwt.verify<{ sub: number }>(userToken).sub).toBe(user.id);
            const after = await app.inject({
                method: "GET", url: "/auth/me", headers: { authorization: `Bearer ${userToken}` }
            });
            expect(after.statusCode).toBe(401);
            expect(after.json().message).toBe("Usuário inativo");
        });

        test("Usuário reativado pode fazer login e voltar a acessar o sistema", async () => {
            const firstLogin = await loginUser();
            expect(firstLogin.statusCode).toBe(200);
            const previousToken = firstLogin.json().token;
            expect((await changeStatus(false)).statusCode).toBe(200);
            expect((await changeStatus(true)).statusCode).toBe(200);
            const login = await loginUser();
            expect(login.statusCode).toBe(200);
            expect(login.json().token).toEqual(expect.any(String));
            expect((await prisma.usuario.findUniqueOrThrow({ where: { id: user.id } })).ativo).toBe(true);
            expect(await countStatusLogs()).toBe(2);

            const access = await app.inject({
                method: "GET", url: "/auth/me", headers: { authorization: `Bearer ${previousToken}` }
            });
            expect(access.statusCode).toBe(200);
        });

        test("Admin não pode desativar a própria conta", async () => {
            const response = await app.inject({
                method: "PATCH", url: `/api/users/${admin.id}/status`,
                headers: { authorization: `Bearer ${adminToken}` }, payload: { ativo: false }
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Você não pode desativar sua própria conta");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: admin.id } })).toEqual(admin);
            expect(await countStatusLogs()).toBe(0);
        });

        test("Aluno não pode alterar o status de outro usuário", async () => {
            const studentToken = app.jwt.sign({ sub: user.id, role: UserRole.ALUNO });
            const response = await app.inject({
                method: "PATCH", url: `/api/users/${admin.id}/status`,
                headers: { authorization: `Bearer ${studentToken}` }, payload: { ativo: false }
            });
            expect(response.statusCode).toBe(403);
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: admin.id } })).toEqual(admin);
            expect(await prisma.logs.count({ where: { user_id: user.id, action: "ALTERACAO_STATUS_USUARIO" } })).toBe(0);
        });

        test("Professor não pode alterar o status de outro usuário", async () => {
            await prisma.usuario.update({ where: { id: user.id }, data: { role: user_role.Professor_a_ } });
            const teacherToken = app.jwt.sign({ sub: user.id, role: UserRole.PROFESSOR });
            const response = await app.inject({
                method: "PATCH", url: `/api/users/${admin.id}/status`,
                headers: { authorization: `Bearer ${teacherToken}` }, payload: { ativo: false }
            });
            expect(response.statusCode).toBe(403);
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: admin.id } })).toEqual(admin);
            expect(await prisma.logs.count({ where: { user_id: user.id, action: "ALTERACAO_STATUS_USUARIO" } })).toBe(0);
        });

        test("Requisição sem autenticação não pode alterar o status de um usuário", async () => {
            const response = await app.inject({
                method: "PATCH", url: `/api/users/${user.id}/status`, payload: { ativo: false }
            });
            expect(response.statusCode).toBe(401);
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: user.id } })).toEqual(user);
            expect(await countStatusLogs()).toBe(0);
        });

        test("Repetir o mesmo status não cria outro log", async () => {
            expect((await changeStatus(false)).statusCode).toBe(200);
            expect((await changeStatus(false)).statusCode).toBe(200);
            expect(await countStatusLogs()).toBe(1);
            expect((await changeStatus(true)).statusCode).toBe(200);
            expect((await changeStatus(true)).statusCode).toBe(200);
            expect(await countStatusLogs()).toBe(2);
            expect((await prisma.usuario.findUniqueOrThrow({ where: { id: user.id } })).ativo).toBe(true);
        });

        test("Alteração de status rejeita dados inválidos sem modificar a conta", async () => {
            const invalidBodies = [{}, { ativo: "false" }, { ativo: 0 }, { ativo: null }, { ativo: false, role: UserRole.ADMIN }];
            for (const payload of invalidBodies) {
                const response = await app.inject({
                    method: "PATCH", url: `/api/users/${user.id}/status`,
                    headers: { authorization: `Bearer ${adminToken}` }, payload
                });
                expect(response.statusCode).toBe(400);
                expect(response.json().message).toBe("Dados inválidos");
            }
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: user.id } })).toEqual(user);
            expect(await countStatusLogs()).toBe(0);
        });

        test("Alteração de status rejeita um ID inválido", async () => {
            for (const id of ["abc", "0", "-1", "1.5"]) {
                const response = await app.inject({
                    method: "PATCH", url: `/api/users/${id}/status`,
                    headers: { authorization: `Bearer ${adminToken}` }, payload: { ativo: false }
                });
                expect(response.statusCode).toBe(400);
                expect(response.json().message).toBe("ID inválido");
            }
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: user.id } })).toEqual(user);
            expect(await countStatusLogs()).toBe(0);
        });

        test("Alteração de status rejeita um usuário inexistente", async () => {
            await prisma.usuario.delete({ where: { id: user.id } });
            const response = await changeStatus(false);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Usuário não encontrado");
            expect(await countStatusLogs()).toBe(0);
        });

        test("Falha ao salvar o log desfaz a ativação ou desativação da conta", async () => {
            for (const ativo of [false, true]) {
                await prisma.usuario.update({ where: { id: user.id }, data: { ativo: !ativo } });
                jest.mocked(createLogService).mockRejectedValueOnce(new Error("Falha ao salvar log"));
                const response = await changeStatus(ativo);
                expect(response.statusCode).toBe(400);
                expect(response.json().message).toBe("Falha ao salvar log");
                expect(await prisma.usuario.findUniqueOrThrow({ where: { id: user.id } })).toEqual({ ...user, ativo: !ativo });
                expect(await countStatusLogs()).toBe(0);
            }
        });
    });
});
