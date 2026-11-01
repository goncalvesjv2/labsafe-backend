import "dotenv/config";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { app } from "../../app";
import { prisma } from "../../database/prisma";
import { user_role } from "../../generated/prisma/enums";

describe("Teste de integração de conteúdos", () => {
    let baseUrl: string;
    let token: string;
    let teacherId: number;
    const teacherEmail = `professor.${randomUUID()}@example.com`;
    const studentEmail = `aluno.conteudo.${randomUUID()}@example.com`;
    const password = "SenhaTeste123!";

    beforeAll(async () => {
        baseUrl = await app.listen({ port: 0, host: "127.0.0.1" });
        const teacher = await prisma.usuario.create({
            data: {
                name: "Professor Teste",
                email: teacherEmail,
                senha: await bcrypt.hash(password, 10),
                role: user_role.Professor_a_
            }
        });
        teacherId = teacher.id;

        const login = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: teacherEmail, password })
        });
        expect(login.status).toBe(200);
        const loginBody = await login.json();
        expect(loginBody.token).toEqual(expect.any(String));
        token = loginBody.token;
    }, 30000);

    afterAll(async () => {
        try {
            const emails = [teacherEmail, studentEmail];
            await prisma.conteudo.deleteMany({ where: { usuario: { email: { in: emails } } } });
            await prisma.logs.deleteMany({ where: { usuario: { email: { in: emails } } } });
            await prisma.usuario.deleteMany({ where: { email: { in: emails } } });
        } finally {
            await Promise.all([app.close(), prisma.$disconnect()]);
        }
    }, 30000);

    test("deve permitir que o professor cadastre um conteúdo", async () => {
        const content = {
            title: "Segurança no laboratório",
            description: "Use os equipamentos de proteção durante as atividades."
        };

        const response = await fetch(`${baseUrl}/api/contents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(content)
        });
        expect(response.status).toBe(201);
        expect(response.headers.get("content-type")).toContain("application/json");
        const body = await response.json();
        expect(body).toMatchObject({
            id: expect.any(Number),
            teacherId,
            title: content.title,
            description: content.description
        });

        const savedContent = await prisma.conteudo.findUniqueOrThrow({ where: { id: body.id } });
        expect(savedContent).toMatchObject({
            id: body.id,
            professor_id: teacherId,
            title: content.title,
            description: content.description
        });
    }, 30000);

    test("deve listar conteúdos e encontrar o conteúdo cadastrado", async () => {
        const content = {
            title: "Cuidados com os equipamentos",
            description: "Confira os equipamentos antes de iniciar as atividades."
        };

        const createResponse = await fetch(`${baseUrl}/api/contents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(content)
        });
        expect(createResponse.status).toBe(201);
        const createdContent = await createResponse.json();

        const response = await fetch(`${baseUrl}/api/contents`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toContainEqual(expect.objectContaining({
            id: createdContent.id,
            teacherId,
            title: content.title,
            description: content.description
        }));
    }, 30000);

    test("deve consultar um conteúdo pelo ID", async () => {
        const content = {
            title: "Uso de luvas de proteção",
            description: "Utilize luvas adequadas ao manusear produtos químicos."
        };

        const createResponse = await fetch(`${baseUrl}/api/contents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(content)
        });
        expect(createResponse.status).toBe(201);
        const createdContent = await createResponse.json();

        const response = await fetch(`${baseUrl}/api/contents/${createdContent.id}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toMatchObject({
            id: createdContent.id,
            teacherId,
            title: content.title,
            description: content.description
        });
    }, 30000);

    test("deve permitir que o professor atualize seu próprio conteúdo", async () => {
        const content = {
            title: "Orientações iniciais",
            description: "Leia as orientações antes de entrar no laboratório."
        };

        const createResponse = await fetch(`${baseUrl}/api/contents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(content)
        });
        expect(createResponse.status).toBe(201);
        const createdContent = await createResponse.json();

        const updatedContent = {
            title: "Orientações atualizadas",
            description: "Confira as novas orientações de segurança do laboratório."
        };
        const response = await fetch(`${baseUrl}/api/contents/${createdContent.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(updatedContent)
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toMatchObject({
            id: createdContent.id,
            teacherId,
            title: updatedContent.title,
            description: updatedContent.description
        });

        const savedContent = await prisma.conteudo.findUniqueOrThrow({ where: { id: createdContent.id } });
        expect(savedContent).toMatchObject({
            id: createdContent.id,
            professor_id: teacherId,
            title: updatedContent.title,
            description: updatedContent.description
        });
    }, 30000);

    test("deve permitir que o professor exclua seu próprio conteúdo", async () => {
        const content = {
            title: "Conteúdo para exclusão",
            description: "Este conteúdo será removido durante o teste."
        };

        const createResponse = await fetch(`${baseUrl}/api/contents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(content)
        });
        expect(createResponse.status).toBe(201);
        const createdContent = await createResponse.json();

        const response = await fetch(`${baseUrl}/api/contents/${createdContent.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(response.status).toBe(204);
        expect(await response.text()).toBe("");

        const deletedContent = await prisma.conteudo.findUnique({ where: { id: createdContent.id } });
        expect(deletedContent).toBeNull();
    }, 30000);

    test("deve rejeitar cadastro de conteúdo com título vazio", async () => {
        const content = {
            title: "",
            description: "Descrição válida para testar o título obrigatório."
        };
        const totalBefore = await prisma.conteudo.count({ where: { professor_id: teacherId } });

        const response = await fetch(`${baseUrl}/api/contents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(content)
        });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toBe("Dados inválidos");
        expect(body.errors).toContainEqual(expect.objectContaining({
            path: ["title"],
            message: "O título é obrigatório"
        }));

        const totalAfter = await prisma.conteudo.count({ where: { professor_id: teacherId } });
        expect(totalAfter).toBe(totalBefore);
    }, 30000);

    test("deve rejeitar cadastro de conteúdo sem token", async () => {
        const content = {
            title: `Conteúdo sem token ${randomUUID()}`,
            description: "Tentativa de cadastro sem autenticação."
        };

        const response = await fetch(`${baseUrl}/api/contents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(content)
        });
        expect(response.status).toBe(401);
        const body = await response.json();
        expect(body.code).toBe("FST_JWT_NO_AUTHORIZATION_IN_HEADER");
        expect(body.message).toBe("No Authorization was found in request.headers");

        const total = await prisma.conteudo.count({ where: { title: content.title } });
        expect(total).toBe(0);
    }, 30000);

    test("deve impedir que um aluno autenticado cadastre conteúdo", async () => {
        await prisma.usuario.create({
            data: {
                name: "Aluno Teste",
                email: studentEmail,
                senha: await bcrypt.hash(password, 10),
                role: user_role.Aluno_a_
            }
        });

        const login = await fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: studentEmail, password })
        });
        expect(login.status).toBe(200);
        const loginBody = await login.json();
        expect(loginBody.token).toEqual(expect.any(String));
        const studentToken = loginBody.token;
        const content = {
            title: `Conteúdo do aluno ${randomUUID()}`,
            description: "Tentativa de cadastro por um aluno autenticado."
        };
        const response = await fetch(`${baseUrl}/api/contents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            body: JSON.stringify(content)
        });
        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.message).toBe("Somente professores podem executar esta ação");
        const total = await prisma.conteudo.count({ where: { title: content.title } });
        expect(total).toBe(0);
    }, 30000);
});
