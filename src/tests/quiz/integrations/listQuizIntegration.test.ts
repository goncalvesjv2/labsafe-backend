import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupQuizIntegration } from "./helpers/setupQuizIntegration";

describe("Testes de integração do quiz", () => {
    const context = setupQuizIntegration();

    test("deve permitir que professor e aluno listem os quizzes", async () => {
        const { content, quiz } = await context.createQuizFixture();
        for (const token of [context.teacherToken, context.studentToken]) {
            const response = await app.inject({
                method: "GET",
                url: "/api/quizzes",
                headers: { authorization: `Bearer ${token}` }
            });
            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body).toContainEqual({ id: quiz.id, contentId: content.id, teacherId: context.teacherId, createdAt: quiz.created_at?.toISOString() });
        }
    }, 30000);

    test("deve permitir que professor e aluno consultem um quiz pelo ID", async () => {
        const { content, quiz } = await context.createQuizFixture();
        for (const token of [context.teacherToken, context.studentToken]) {
            const response = await app.inject({
                method: "GET",
                url: `/api/quizzes/${quiz.id}`,
                headers: { authorization: `Bearer ${token}` }
            });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ id: quiz.id, contentId: content.id, teacherId: context.teacherId, createdAt: quiz.created_at?.toISOString() });
        }
    }, 30000);

    test("retorna data nula para um quiz sem data de criação conhecida", async () => {
        const { quiz } = await context.createQuizFixture();
        await prisma.quiz.update({ where: { id: quiz.id }, data: { created_at: null } });

        const response = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().createdAt).toBeNull();
    }, 30000);
});
