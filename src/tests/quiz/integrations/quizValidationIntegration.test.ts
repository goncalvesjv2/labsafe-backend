import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupQuizIntegration } from "./helpers/setupQuizIntegration";

describe("Testes de integração do quiz", () => {
    const context = setupQuizIntegration();

    test("deve rejeitar IDs inválidos na consulta, edição e exclusão", async () => {
        const totalBefore = await context.countQuizzes();
        for (const id of ["0", "-1", "1.5", "abc", "Infinity"]) {
            const getResponse = await app.inject({
                method: "GET",
                url: `/api/quizzes/${id}`,
                headers: { authorization: `Bearer ${context.teacherToken}` }
            });
            expect(getResponse.statusCode).toBe(400);
            expect(getResponse.json()).toEqual({ message: "ID inválido" });
            const patchResponse = await app.inject({
                method: "PATCH",
                url: `/api/quizzes/${id}`,
                headers: { authorization: `Bearer ${context.teacherToken}` }
            });
            expect(patchResponse.statusCode).toBe(400);
            expect(patchResponse.json()).toEqual({ message: "ID inválido" });
            const removeResponse = await app.inject({
                method: "DELETE",
                url: `/api/quizzes/${id}`,
                headers: { authorization: `Bearer ${context.teacherToken}` }
            });
            expect(removeResponse.statusCode).toBe(400);
            expect(removeResponse.json()).toEqual({ message: "ID inválido" });
        }
        expect(await context.countQuizzes()).toBe(totalBefore);
    }, 30000);

    test("deve rejeitar corpos inválidos no cadastro e na atualização", async () => {
        const { quiz } = await context.createQuizFixture();
        const totalBefore = await context.countQuizzes();
        const invalidBodies = [{}, { contentId: null }, { contentId: "1" }, { contentId: true },
            { contentId: 0 }, { contentId: -1 }, { contentId: 1.5 }];
        for (const body of invalidBodies) {
            const post = await app.inject({
                method: "POST",
                url: "/api/quizzes",
                headers: { authorization: `Bearer ${context.teacherToken}` },
                payload: body
            });
            const patch = await app.inject({
                method: "PATCH",
                url: `/api/quizzes/${quiz.id}`,
                headers: { authorization: `Bearer ${context.teacherToken}` },
                payload: body
            });
            expect(post.statusCode).toBe(400);
            expect(patch.statusCode).toBe(400);
            expect(post.json().message).toBe("Dados inválidos");
            expect(patch.json().message).toBe("Dados inválidos");
        }
        expect(await context.countQuizzes()).toBe(totalBefore);
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toEqual(quiz);
    }, 30000);

    test("deve rejeitar cadastro e atualização para um conteúdo inexistente", async () => {
        const missingContent = await context.createContent();
        await prisma.conteudo.delete({ where: { id: missingContent.id } });
        const { quiz } = await context.createQuizFixture();
        const totalBefore = await context.countQuizzes();
        const post = await app.inject({
            method: "POST",
            url: "/api/quizzes",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { contentId: missingContent.id }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { contentId: missingContent.id }
        });
        expect(post.statusCode).toBe(400);
        expect(patch.statusCode).toBe(400);
        expect(post.json().message).toBe("Conteúdo não encontrado");
        expect(patch.json().message).toBe("Conteúdo não encontrado");
        expect(await context.countQuizzes()).toBe(totalBefore);
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toEqual(quiz);
    }, 30000);

    test("deve tratar consulta, edição e exclusão de um quiz inexistente", async () => {
        const { quiz, content } = await context.createQuizFixture();
        await prisma.quiz.delete({ where: { id: quiz.id } });
        const get = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });
        const patch = await app.inject({
            method: "PATCH",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { contentId: content.id }
        });
        const remove = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });
        expect(get.statusCode).toBe(404);
        expect(patch.statusCode).toBe(400);
        expect(remove.statusCode).toBe(500);
        expect(get.json().message).toBe("Quiz não encontrado");
        expect(patch.json().message).toBe("Quiz não encontrado");
        expect(remove.json().message).toBe("Quiz não encontrado");
        expect(await prisma.quiz.findUnique({ where: { conteudo_id: content.id } })).toBeNull();
    }, 30000);
});
