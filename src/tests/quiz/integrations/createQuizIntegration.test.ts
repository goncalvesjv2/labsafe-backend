import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupQuizIntegration } from "./helpers/setupQuizIntegration";

describe("Testes de integração do quiz", () => {
    const context = setupQuizIntegration();

    test("deve cadastrar um quiz em um conteúdo próprio e registrar o log", async () => {
        const content = await context.createContent();
        const response = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { contentId: content.id, teacherId: context.otherTeacherId, id: 999 }
        });
        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body).toEqual({ id: expect.any(Number), contentId: content.id, teacherId: context.teacherId });
        const savedQuiz = await prisma.quiz.findUniqueOrThrow({ where: { id: body.id } });
        expect(savedQuiz.conteudo_id).toBe(content.id);
        expect(savedQuiz.professor_id).toBe(context.teacherId);
        const logs = await prisma.logs.findMany({
            where: { user_id: context.teacherId, action: "CADASTRO_QUIZ", description: { contains: `quiz de ID ${body.id} ` } }
        });
        expect(logs).toHaveLength(1);
    }, 30000);

    test("deve impedir um segundo quiz para o mesmo conteúdo", async () => {
        const { content, quiz } = await context.createQuizFixture();
        const response = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { contentId: content.id }
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Este conteúdo já possui um quiz");
        expect(await prisma.quiz.findMany({ where: { conteudo_id: content.id } })).toEqual([quiz]);
    }, 30000);

    test("deve impedir o cadastro em conteúdo de outro professor", async () => {
        const content = await context.createContent(context.otherTeacherId);
        const response = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { contentId: content.id }
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Você pode somente criar quizzes para seus próprios conteúdos");
        expect(await prisma.quiz.findUnique({ where: { conteudo_id: content.id } })).toBeNull();
    }, 30000);
});
