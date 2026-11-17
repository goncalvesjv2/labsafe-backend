import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupQuizIntegration } from "./helpers/setupQuizIntegration";

describe("Testes de integração do quiz", () => {
    const context = setupQuizIntegration();

    test("deve trocar o conteúdo do quiz mantendo seu ID e registrar o log", async () => {
        const { content, quiz } = await context.createQuizFixture();
        const targetContent = await context.createContent();
        const response = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { contentId: targetContent.id, teacherId: context.otherTeacherId }
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: quiz.id, contentId: targetContent.id, teacherId: context.teacherId });
        const savedQuiz = await prisma.quiz.findUniqueOrThrow({ where: { id: quiz.id } });
        expect(savedQuiz.conteudo_id).toBe(targetContent.id);
        expect(savedQuiz.professor_id).toBe(context.teacherId);
        expect(await prisma.quiz.findUnique({ where: { conteudo_id: content.id } })).toBeNull();
        const logs = await prisma.logs.findMany({
            where: { user_id: context.teacherId, action: "ALTERACAO_QUIZ", description: { contains: `quiz de ID ${quiz.id},` } }
        });
        expect(logs).toHaveLength(1);
    }, 30000);

    test("deve permitir manter o conteúdo atual sem criar outro quiz", async () => {
        const { content, quiz } = await context.createQuizFixture();
        const response = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { contentId: content.id }
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: quiz.id, contentId: content.id, teacherId: context.teacherId });
        expect(await prisma.quiz.count({ where: { conteudo_id: content.id } })).toBe(1);
    }, 30000);

    test("deve impedir a troca para um conteúdo que já possui outro quiz", async () => {
        const original = await context.createQuizFixture();
        const target = await context.createQuizFixture();
        const response = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${original.quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { contentId: target.content.id }
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Este conteúdo já possui um quiz");
        expect(await prisma.quiz.findUnique({ where: { id: original.quiz.id } })).toEqual(original.quiz);
        expect(await prisma.quiz.findUnique({ where: { id: target.quiz.id } })).toEqual(target.quiz);
    }, 30000);

    test("deve impedir mover o próprio quiz para conteúdo de outro professor", async () => {
        const { quiz } = await context.createQuizFixture();
        const targetContent = await context.createContent(context.otherTeacherId);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { contentId: targetContent.id }
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Você pode somente vincular quizzes aos seus próprios conteúdos");
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toEqual(quiz);
        expect(await prisma.quiz.findUnique({ where: { conteudo_id: targetContent.id } })).toBeNull();
    }, 30000);
});
