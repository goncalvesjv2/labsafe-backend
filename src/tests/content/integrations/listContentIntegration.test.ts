import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import bcrypt from "bcrypt";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { user_role } from "../../../generated/prisma/enums";
import { setupContentIntegration } from "./helpers/setupContentIntegration";

jest.mock("../../../services/emailService", () => ({
    sendEmailService: jest.fn().mockResolvedValue({ messageId: "email-teste" })
}));

describe("Teste de integração de conteúdos", () => {
    const context = setupContentIntegration();

    test("deve listar conteúdos e encontrar o conteúdo cadastrado", async () => {
        const content = {
            title: "Cuidados com os equipamentos",
            description: "Confira os equipamentos antes de iniciar as atividades."
        };

        const createResponse = await app.inject({
            method: "POST",
            url: "/api/contents",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${context.token}`
            },
            payload: content
        });
        expect(createResponse.statusCode).toBe(201);
        const createdContent = createResponse.json();

        const response = await app.inject({
            method: "GET",
            url: "/api/contents",
            headers: { Authorization: `Bearer ${context.token}` }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toContainEqual(expect.objectContaining({
            id: createdContent.id,
            teacherId: context.teacherId,
            title: content.title,
            description: content.description
        }));
    }, 30000);

    test("deve consultar um conteúdo pelo ID", async () => {
        const content = {
            title: "Uso de luvas de proteção",
            description: "Utilize luvas adequadas ao manusear produtos químicos."
        };

        const createResponse = await app.inject({
            method: "POST",
            url: "/api/contents",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${context.token}`
            },
            payload: content
        });
        expect(createResponse.statusCode).toBe(201);
        const createdContent = createResponse.json();

        const response = await app.inject({
            method: "GET",
            url: `/api/contents/${createdContent.id}`,
            headers: { Authorization: `Bearer ${context.token}` }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toMatchObject({
            id: createdContent.id,
            teacherId: context.teacherId,
            title: content.title,
            description: content.description
        });
    }, 30000);

    test("deve permitir que um aluno autenticado liste os conteúdos", async () => {
        await prisma.usuario.create({
            data: {
                name: "Aluno da listagem",
                email: context.studentListEmail,
                senha: await bcrypt.hash(context.password, 10),
                role: user_role.Aluno_a_
            }
        });
        const login = await app.inject({
            method: "POST",
            url: "/auth/login",
            headers: { "Content-Type": "application/json" },
            payload: { email: context.studentListEmail, password: context.password }
        });
        expect(login.statusCode).toBe(200);
        const loginBody = login.json();
        expect(loginBody.token).toEqual(expect.any(String));

        const content = await prisma.conteudo.create({
            data: {
                professor_id: context.teacherId,
                title: "Conteúdo disponível para alunos",
                description: "Orientações de segurança para consulta."
            }
        });
        const response = await app.inject({
            method: "GET",
            url: "/api/contents",
            headers: { Authorization: `Bearer ${loginBody.token}` }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toContainEqual(expect.objectContaining({ id: content.id, teacherId: context.teacherId }));
    }, 30000);

    test("deve permitir que um aluno autenticado consulte um conteúdo pelo ID", async () => {
        await prisma.usuario.create({
            data: {
                name: "Aluno da consulta",
                email: context.studentDetailEmail,
                senha: await bcrypt.hash(context.password, 10),
                role: user_role.Aluno_a_
            }
        });
        const login = await app.inject({
            method: "POST",
            url: "/auth/login",
            headers: { "Content-Type": "application/json" },
            payload: { email: context.studentDetailEmail, password: context.password }
        });
        expect(login.statusCode).toBe(200);
        const loginBody = login.json();
        expect(loginBody.token).toEqual(expect.any(String));

        const content = await prisma.conteudo.create({
            data: {
                professor_id: context.teacherId,
                title: "Uso dos equipamentos de proteção",
                description: "Consulte os equipamentos necessários para a atividade."
            }
        });
        const response = await app.inject({
            method: "GET",
            url: `/api/contents/${content.id}`,
            headers: { Authorization: `Bearer ${loginBody.token}` }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toMatchObject({ id: content.id, teacherId: context.teacherId, title: content.title, description: content.description });
    }, 30000);

    test("deve impedir que um administrador liste os conteúdos e registrar a tentativa", async () => {
        const admin = await prisma.usuario.create({
            data: {
                name: "Administrador da listagem",
                email: context.adminListEmail,
                senha: await bcrypt.hash(context.password, 10),
                role: user_role.Admin
            }
        });
        const login = await app.inject({
            method: "POST",
            url: "/auth/login",
            headers: { "Content-Type": "application/json" },
            payload: { email: context.adminListEmail, password: context.password }
        });
        expect(login.statusCode).toBe(200);
        const loginBody = login.json();
        expect(loginBody.token).toEqual(expect.any(String));

        const response = await app.inject({
            method: "GET",
            url: "/api/contents",
            headers: { Authorization: `Bearer ${loginBody.token}` }
        });
        expect(response.statusCode).toBe(403);
        const body = response.json();
        expect(body.message).toBe("Somente professores e alunos podem acessar os conteúdos");

        const logs = await prisma.logs.findMany({
            where: { user_id: admin.id, action: "FALHA_AUTORIZACAO" }
        });
        expect(logs).toHaveLength(1);
        expect(logs[0].description).toBe("Usuário tentou acessar uma ação exclusiva de professor ou aluno");
    }, 30000);

    test("deve impedir que um administrador consulte um conteúdo existente pelo ID", async () => {
        const admin = await prisma.usuario.create({
            data: {
                name: "Administrador da consulta",
                email: context.adminDetailEmail,
                senha: await bcrypt.hash(context.password, 10),
                role: user_role.Admin
            }
        });
        const login = await app.inject({
            method: "POST",
            url: "/auth/login",
            headers: { "Content-Type": "application/json" },
            payload: { email: context.adminDetailEmail, password: context.password }
        });
        expect(login.statusCode).toBe(200);
        const loginBody = login.json();
        expect(loginBody.token).toEqual(expect.any(String));

        const content = await prisma.conteudo.create({
            data: {
                professor_id: context.teacherId,
                title: "Conteúdo restrito a professores e alunos",
                description: "O administrador não pode acessar este conteúdo."
            }
        });
        const response = await app.inject({
            method: "GET",
            url: `/api/contents/${content.id}`,
            headers: { Authorization: `Bearer ${loginBody.token}` }
        });
        expect(response.statusCode).toBe(403);
        const body = response.json();
        expect(body.message).toBe("Somente professores e alunos podem acessar os conteúdos");

        const logs = await prisma.logs.findMany({
            where: { user_id: admin.id, action: "FALHA_AUTORIZACAO" }
        });
        expect(logs).toHaveLength(1);
        expect(logs[0].description).toBe("Usuário tentou acessar uma ação exclusiva de professor ou aluno");
    }, 30000);
});
