import { setupUserAccessIntegration } from "./helpers/setupUserAccessIntegration";
import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { user_role } from "../../../generated/prisma/enums";
import { UserRole } from "../../../utils/user";
import { createLogService } from "../../../services/logService";
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

    describe("Cargo, status e acesso", () => {
        const access = setupUserAccessIntegration(context);

        test("Admin pode desativar outro usuário e registrar a alteração", async () => {
            const response = await access.changeStatus(false);
            expect(response.statusCode).toBe(200);
            expect(response.json().ativo).toBe(false);
            expect(response.json()).not.toHaveProperty("senha");
            expect(response.json()).not.toHaveProperty("password");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: access.user.id } })).toEqual({ ...access.user, ativo: false });
            const logs = await prisma.logs.findMany({ where: { user_id: access.admin.id, action: "ALTERACAO_STATUS_USUARIO" } });
            expect(logs).toHaveLength(1);
            expect(logs[0].description).toContain(access.user.email);
            expect(logs[0].description).toContain("desativado");
        });

        test("Usuário já autenticado perde o acesso quando sua conta é desativada", async () => {
            const login = await access.loginUser();
            expect(login.statusCode).toBe(200);
            const userToken = login.json().token;
            const before = await app.inject({
                method: "GET", url: "/auth/me", headers: { authorization: `Bearer ${userToken}` }
            });
            expect(before.statusCode).toBe(200);
            expect((await access.changeStatus(false)).statusCode).toBe(200);
            expect(app.jwt.verify<{ sub: number }>(userToken).sub).toBe(access.user.id);
            const after = await app.inject({
                method: "GET", url: "/auth/me", headers: { authorization: `Bearer ${userToken}` }
            });
            expect(after.statusCode).toBe(401);
            expect(after.json().message).toBe("Usuário inativo");
        });

        test("Usuário reativado pode fazer login e voltar a acessar o sistema", async () => {
            const firstLogin = await access.loginUser();
            expect(firstLogin.statusCode).toBe(200);
            const previousToken = firstLogin.json().token;
            expect((await access.changeStatus(false)).statusCode).toBe(200);
            expect((await access.changeStatus(true)).statusCode).toBe(200);
            const login = await access.loginUser();
            expect(login.statusCode).toBe(200);
            expect(login.json().token).toEqual(expect.any(String));
            expect((await prisma.usuario.findUniqueOrThrow({ where: { id: access.user.id } })).ativo).toBe(true);
            expect(await access.countStatusLogs()).toBe(2);

            const profileResponse = await app.inject({
                method: "GET", url: "/auth/me", headers: { authorization: `Bearer ${previousToken}` }
            });
            expect(profileResponse.statusCode).toBe(200);
        });

        test("Admin não pode desativar a própria conta", async () => {
            const response = await app.inject({
                method: "PATCH", url: `/api/users/${access.admin.id}/status`,
                headers: { authorization: `Bearer ${access.adminToken}` }, payload: { ativo: false }
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Você não pode desativar sua própria conta");
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: access.admin.id } })).toEqual(access.admin);
            expect(await access.countStatusLogs()).toBe(0);
        });

        test("Aluno não pode alterar o status de outro usuário", async () => {
            const studentToken = app.jwt.sign({ sub: access.user.id, role: UserRole.ALUNO });
            const response = await app.inject({
                method: "PATCH", url: `/api/users/${access.admin.id}/status`,
                headers: { authorization: `Bearer ${studentToken}` }, payload: { ativo: false }
            });
            expect(response.statusCode).toBe(403);
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: access.admin.id } })).toEqual(access.admin);
            expect(await prisma.logs.count({ where: { user_id: access.user.id, action: "ALTERACAO_STATUS_USUARIO" } })).toBe(0);
        });

        test("Professor não pode alterar o status de outro usuário", async () => {
            await prisma.usuario.update({ where: { id: access.user.id }, data: { role: user_role.Professor_a_ } });
            const teacherToken = app.jwt.sign({ sub: access.user.id, role: UserRole.PROFESSOR });
            const response = await app.inject({
                method: "PATCH", url: `/api/users/${access.admin.id}/status`,
                headers: { authorization: `Bearer ${teacherToken}` }, payload: { ativo: false }
            });
            expect(response.statusCode).toBe(403);
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: access.admin.id } })).toEqual(access.admin);
            expect(await prisma.logs.count({ where: { user_id: access.user.id, action: "ALTERACAO_STATUS_USUARIO" } })).toBe(0);
        });

        test("Requisição sem autenticação não pode alterar o status de um usuário", async () => {
            const response = await app.inject({
                method: "PATCH", url: `/api/users/${access.user.id}/status`, payload: { ativo: false }
            });
            expect(response.statusCode).toBe(401);
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: access.user.id } })).toEqual(access.user);
            expect(await access.countStatusLogs()).toBe(0);
        });

        test("Repetir o mesmo status não cria outro log", async () => {
            expect((await access.changeStatus(false)).statusCode).toBe(200);
            expect((await access.changeStatus(false)).statusCode).toBe(200);
            expect(await access.countStatusLogs()).toBe(1);
            expect((await access.changeStatus(true)).statusCode).toBe(200);
            expect((await access.changeStatus(true)).statusCode).toBe(200);
            expect(await access.countStatusLogs()).toBe(2);
            expect((await prisma.usuario.findUniqueOrThrow({ where: { id: access.user.id } })).ativo).toBe(true);
        });

        test("Alteração de status rejeita dados inválidos sem modificar a conta", async () => {
            const invalidBodies = [{}, { ativo: "false" }, { ativo: 0 }, { ativo: null }, { ativo: false, role: UserRole.ADMIN }];
            for (const payload of invalidBodies) {
                const response = await app.inject({
                    method: "PATCH", url: `/api/users/${access.user.id}/status`,
                    headers: { authorization: `Bearer ${access.adminToken}` }, payload
                });
                expect(response.statusCode).toBe(400);
                expect(response.json().message).toBe("Dados inválidos");
            }
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: access.user.id } })).toEqual(access.user);
            expect(await access.countStatusLogs()).toBe(0);
        });

        test("Alteração de status rejeita um ID inválido", async () => {
            for (const id of ["abc", "0", "-1", "1.5"]) {
                const response = await app.inject({
                    method: "PATCH", url: `/api/users/${id}/status`,
                    headers: { authorization: `Bearer ${access.adminToken}` }, payload: { ativo: false }
                });
                expect(response.statusCode).toBe(400);
                expect(response.json().message).toBe("ID inválido");
            }
            expect(await prisma.usuario.findUniqueOrThrow({ where: { id: access.user.id } })).toEqual(access.user);
            expect(await access.countStatusLogs()).toBe(0);
        });

        test("Alteração de status rejeita um usuário inexistente", async () => {
            await prisma.usuario.delete({ where: { id: access.user.id } });
            const response = await access.changeStatus(false);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Usuário não encontrado");
            expect(await access.countStatusLogs()).toBe(0);
        });

        test("Falha ao salvar o log desfaz a ativação ou desativação da conta", async () => {
            for (const ativo of [false, true]) {
                await prisma.usuario.update({ where: { id: access.user.id }, data: { ativo: !ativo } });
                jest.mocked(createLogService).mockRejectedValueOnce(new Error("Falha ao salvar log"));
                const response = await access.changeStatus(ativo);
                expect(response.statusCode).toBe(400);
                expect(response.json().message).toBe("Falha ao salvar log");
                expect(await prisma.usuario.findUniqueOrThrow({ where: { id: access.user.id } })).toEqual({ ...access.user, ativo: !ativo });
                expect(await access.countStatusLogs()).toBe(0);
            }
        });
    });
});
