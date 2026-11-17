import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { user_role } from "../../../generated/prisma/enums";
import { setupAlternativeIntegration } from "./helpers/setupAlternativeIntegration";

describe("Testes de integração de alternativas", () => {
    const context = setupAlternativeIntegration();

    test("deve listar todas as alternativas e esconder correct do aluno", async () => {
        const question = await context.createQuestion();
        const { correctAlternative, incorrectAlternative } = await context.createAlternatives(question.id);
        const teacherResponse = await app.inject({
            method: "GET",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });
        const studentResponse = await app.inject({
            method: "GET",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${context.studentToken}` }
        });

        expect(teacherResponse.statusCode).toBe(200);
        expect(studentResponse.statusCode).toBe(200);
        expect(teacherResponse.json()).toContainEqual({ id: correctAlternative.id, questionId: question.id, text: correctAlternative.text, correct: true });
        expect(teacherResponse.json()).toContainEqual({ id: incorrectAlternative.id, questionId: question.id, text: incorrectAlternative.text, correct: false });
        expect(studentResponse.json()).toContainEqual({ id: correctAlternative.id, questionId: question.id, text: correctAlternative.text });
        expect(studentResponse.json()).toContainEqual({ id: incorrectAlternative.id, questionId: question.id, text: incorrectAlternative.text });
        for (const alternative of studentResponse.json()) {
            expect(alternative).not.toHaveProperty("correct");
        }
    });

    test("deve permitir a consulta pelo ID para professores e aluno", async () => {
        const question = await context.createQuestion();
        const { correctAlternative } = await context.createAlternatives(question.id);

        for (const token of [context.teacherToken, context.otherTeacherToken]) {
            const response = await app.inject({
                method: "GET",
                url: `/api/alternatives/${correctAlternative.id}`,
                headers: { authorization: `Bearer ${token}` }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ id: correctAlternative.id, questionId: question.id, text: correctAlternative.text, correct: true });
        }

        const studentResponse = await app.inject({
            method: "GET",
            url: `/api/alternatives/${correctAlternative.id}`,
            headers: { authorization: `Bearer ${context.studentToken}` }
        });
        expect(studentResponse.statusCode).toBe(200);
        expect(studentResponse.json()).toEqual({ id: correctAlternative.id, questionId: question.id, text: correctAlternative.text });
    });

    test("deve listar somente as alternativas da questão informada", async () => {
        const question = await context.createQuestion();
        const { correctAlternative, incorrectAlternative } = await context.createAlternatives(question.id);
        const otherQuestion = await context.createQuestion();
        await context.createAlternatives(otherQuestion.id);
        const teacherResponse = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}/alternatives`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });
        const studentResponse = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}/alternatives`,
            headers: { authorization: `Bearer ${context.studentToken}` }
        });

        expect(teacherResponse.statusCode).toBe(200);
        expect(studentResponse.statusCode).toBe(200);
        expect(teacherResponse.json()).toEqual([
            { id: correctAlternative.id, questionId: question.id, text: correctAlternative.text, correct: true },
            { id: incorrectAlternative.id, questionId: question.id, text: incorrectAlternative.text, correct: false }
        ]);
        expect(studentResponse.json()).toEqual([
            { id: correctAlternative.id, questionId: question.id, text: correctAlternative.text },
            { id: incorrectAlternative.id, questionId: question.id, text: incorrectAlternative.text }
        ]);
    });

    test("deve retornar uma lista vazia para uma questão sem alternativas", async () => {
        const question = await context.createQuestion();
        const response = await app.inject({
            method: "GET",
            url: `/api/questions/${question.id}/alternatives`,
            headers: { authorization: `Bearer ${context.studentToken}` }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([]);
    });

    test("deve esconder correct se o professor virar aluno mesmo com o token antigo", async () => {
        const question = await context.createQuestion();
        const { correctAlternative } = await context.createAlternatives(question.id);
        await prisma.usuario.update({ where: { id: context.otherTeacherId }, data: { role: user_role.Aluno_a_ } });

        try {
            const list = await app.inject({
                method: "GET",
                url: "/api/alternatives",
                headers: { authorization: `Bearer ${context.otherTeacherToken}` }
            });
            const byId = await app.inject({
                method: "GET",
                url: `/api/alternatives/${correctAlternative.id}`,
                headers: { authorization: `Bearer ${context.otherTeacherToken}` }
            });
            const byQuestion = await app.inject({
                method: "GET",
                url: `/api/questions/${question.id}/alternatives`,
                headers: { authorization: `Bearer ${context.otherTeacherToken}` }
            });

            expect(list.statusCode).toBe(200);
            expect(byId.statusCode).toBe(200);
            expect(byQuestion.statusCode).toBe(200);
            expect(byId.json()).toEqual({ id: correctAlternative.id, questionId: question.id, text: correctAlternative.text });
            for (const alternative of list.json()) {
                expect(alternative).not.toHaveProperty("correct");
            }
            for (const alternative of byQuestion.json()) {
                expect(alternative).not.toHaveProperty("correct");
            }
        } finally {
            await prisma.usuario.update({ where: { id: context.otherTeacherId }, data: { role: user_role.Professor_a_ } });
        }
    });
});
