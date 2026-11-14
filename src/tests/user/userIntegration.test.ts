/// <reference types="jest" />
import "dotenv/config";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { app } from "../../app";
import { prisma } from "../../database/prisma";
import { user_role } from "../../generated/prisma/enums";
import { UserRole } from "../../utils/user";
import type { IUserFormat } from "../../interfaces/IUserFormat";
import { createLogService } from "../../services/logService";

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
        try {
            const emails = [adminEmail, email, listEmail, idEmail, updateEmail, deleteEmail, duplicateEmail, invalidEmail, missingEmail, missingUpdateEmail];
            await prisma.logs.deleteMany({ where: { usuario: { email: { in: emails } } } });
            await prisma.usuario.deleteMany({ where: { email: { in: emails } } });
        } finally {
            await Promise.all([app.close(), prisma.$disconnect()]);
        }
    }, 30000);

    test("deve criar um usuário salvando o e-mail em minúsculas e sem espaços nas extremidades", async () => {
        const user = { name: "Aluno Teste", email: `  ${email.toUpperCase()}  `, password, role: UserRole.ALUNO };

        const response = await app.inject({
            method: "POST",
            url: "/api/users",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            payload: user
        });
        expect(response.statusCode).toBe(201);
        expect(response.headers["content-type"]).toContain("application/json");
        const body = response.json();
        expect(body).toMatchObject({ id: expect.any(Number), name: user.name, email, role: user.role });
        expect(body).not.toHaveProperty("senha");
        expect(body).not.toHaveProperty("password");
        const savedUser = await prisma.usuario.findUniqueOrThrow({ where: { email } });
        expect(savedUser).toMatchObject({ id: body.id, name: user.name, email, role: user_role.Aluno_a_ });
        expect(savedUser.senha).not.toBe(password);
        expect(await bcrypt.compare(password, savedUser.senha)).toBe(true);
    }, 30000);

    test("deve listar usuários e encontrar o usuário cadastrado", async () => {
        const user = { name: "Aluno Listagem", email: listEmail, password, role: UserRole.ALUNO };

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
        const user = { name: "Aluno Consulta", email: idEmail, password, role: UserRole.ALUNO };
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
        const user = { name: "Aluno Antes", email: updateEmail, password, role: UserRole.ALUNO };

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
        const user = { name: "Aluno Exclusão", email: deleteEmail, password, role: UserRole.ALUNO };

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
        const user = { name: "Aluno Original", email: duplicateEmail, password, role: UserRole.ALUNO };
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
        const duplicateUser = { name: "Outro Aluno", email: `  ${duplicateEmail.toUpperCase()}  `, password, role: UserRole.ALUNO };
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
        const user = { name: "Aluno Inválido", email: invalidEmail, password, role: UserRole.ALUNO };

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
        const user = { name: "Aluno Temporário", email: missingEmail, password, role: UserRole.ALUNO };
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

    describe("Cargo, status e acesso", () => {
        let admin: IUserFormat;
        let user: IUserFormat;
        let adminToken: string;
        let createdIds: number[];

        beforeEach(async () => {
            createdIds = [];
            jest.mocked(createLogService).mockReset();
            jest.mocked(createLogService).mockImplementation(originalCreateLogService);

            admin = await prisma.usuario.create({
                data: { name: "Admin Teste", email: `admin.status.${randomUUID()}@example.com`, senha: passwordHash, role: user_role.Admin }
            });
            createdIds.push(admin.id);

            user = await prisma.usuario.create({
                data: { name: "Aluno Teste", email: `aluno.status.${randomUUID()}@example.com`, senha: passwordHash, role: user_role.Aluno_a_ }
            });
            createdIds.push(user.id);
            adminToken = app.jwt.sign({ sub: admin.id, role: UserRole.ADMIN });
        });

        afterEach(async () => {
            await prisma.logs.deleteMany({ where: { user_id: { in: createdIds } } });
            await prisma.usuario.deleteMany({ where: { id: { in: createdIds } } });
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
                    payload: { name: "Outro nome", email: admin.email, password: "OutraSenha123!", role }
                });

                expect(response.statusCode).toBe(400);
                expect(response.json().message).toBe("Você não pode alterar seu próprio cargo");
                expect(await prisma.usuario.findUniqueOrThrow({ where: { id: admin.id } })).toEqual(admin);
                expect(await prisma.logs.count({ where: { user_id: admin.id, action: "ALTERACAO_USUARIO" } })).toBe(0);
            }
        });

        test("Admin pode editar nome, e-mail e senha sem mudar o próprio cargo", async () => {
            const newEmail = `novo.${randomUUID()}@example.com`;
            const response = await app.inject({
                method: "PATCH", url: `/api/users/${admin.id}`,
                headers: { authorization: `Bearer ${adminToken}` },
                payload: { name: "Admin Atualizado", email: newEmail, password: "NovaSenha123!", role: UserRole.ADMIN }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).not.toHaveProperty("senha");
            const savedAdmin = await prisma.usuario.findUniqueOrThrow({ where: { id: admin.id } });
            expect(savedAdmin.name).toBe("Admin Atualizado");
            expect(savedAdmin.email).toBe(newEmail);
            expect(savedAdmin.role).toBe(user_role.Admin);
            expect(await bcrypt.compare("NovaSenha123!", savedAdmin.senha)).toBe(true);
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

        test("Admin perde o acesso administrativo com o token antigo após virar aluno", async () => {
            const login = await app.inject({
                method: "POST",
                url: "/auth/login",
                payload: { email: admin.email, password }
            });
            expect(login.statusCode).toBe(200);
            const oldToken = login.json().token;

            const accessBefore = await app.inject({
                method: "GET",
                url: "/api/users",
                headers: { authorization: `Bearer ${oldToken}` }
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
                headers: { authorization: `Bearer ${oldToken}` }
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
