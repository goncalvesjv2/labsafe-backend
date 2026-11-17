import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { randomUUID } from "node:crypto";
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

    test("deve permitir que o professor cadastre um conteúdo", async () => {
        const content = {
            title: "Segurança no laboratório",
            description: "Use os equipamentos de proteção durante as atividades."
        };

        const response = await app.inject({
            method: "POST",
            url: "/api/contents",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${context.token}`
            },
            payload: content
        });
        expect(response.statusCode).toBe(201);
        expect(response.headers["content-type"]).toContain("application/json");
        const body = response.json();
        expect(body).toMatchObject({
            id: expect.any(Number),
            teacherId: context.teacherId,
            title: content.title,
            description: content.description
        });

        const savedContent = await prisma.conteudo.findUniqueOrThrow({ where: { id: body.id } });
        expect(savedContent).toMatchObject({
            id: body.id,
            professor_id: context.teacherId,
            title: content.title,
            description: content.description
        });
    }, 30000);

    test("deve rejeitar cadastro de conteúdo com título vazio", async () => {
        const content = {
            title: "",
            description: "Descrição válida para testar o título obrigatório."
        };
        const totalBefore = await prisma.conteudo.count({ where: { professor_id: context.teacherId } });

        const response = await app.inject({
            method: "POST",
            url: "/api/contents",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${context.token}`
            },
            payload: content
        });
        expect(response.statusCode).toBe(400);
        const body = response.json();
        expect(body.message).toBe("Dados inválidos");
        expect(body.errors).toContainEqual(expect.objectContaining({
            path: ["title"],
            message: "O título é obrigatório"
        }));

        const totalAfter = await prisma.conteudo.count({ where: { professor_id: context.teacherId } });
        expect(totalAfter).toBe(totalBefore);
    }, 30000);

    test("deve rejeitar cadastro de conteúdo sem token", async () => {
        const content = {
            title: `Conteúdo sem token ${randomUUID()}`,
            description: "Tentativa de cadastro sem autenticação."
        };

        const response = await app.inject({
            method: "POST",
            url: "/api/contents",
            headers: { "Content-Type": "application/json" },
            payload: content
        });
        expect(response.statusCode).toBe(401);
        const body = response.json();
        expect(body.code).toBe("FST_JWT_NO_AUTHORIZATION_IN_HEADER");
        expect(body.message).toBe("No Authorization was found in request.headers");

        const total = await prisma.conteudo.count({ where: { title: content.title } });
        expect(total).toBe(0);
    }, 30000);

    test("deve impedir que um aluno autenticado cadastre conteúdo", async () => {
        await prisma.usuario.create({
            data: {
                name: "Aluno Teste",
                email: context.studentEmail,
                senha: await bcrypt.hash(context.password, 10),
                role: user_role.Aluno_a_
            }
        });

        const login = await app.inject({
            method: "POST",
            url: "/auth/login",
            headers: { "Content-Type": "application/json" },
            payload: { email: context.studentEmail, password: context.password }
        });
        expect(login.statusCode).toBe(200);
        const loginBody = login.json();
        expect(loginBody.token).toEqual(expect.any(String));
        const studentToken = loginBody.token;
        const content = {
            title: `Conteúdo do aluno ${randomUUID()}`,
            description: "Tentativa de cadastro por um aluno autenticado."
        };
        const response = await app.inject({
            method: "POST",
            url: "/api/contents",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentToken}`
            },
            payload: content
        });
        expect(response.statusCode).toBe(403);
        const body = response.json();
        expect(body.message).toBe("Somente professores podem executar esta ação");
        const total = await prisma.conteudo.count({ where: { title: content.title } });
        expect(total).toBe(0);
    }, 30000);
});
