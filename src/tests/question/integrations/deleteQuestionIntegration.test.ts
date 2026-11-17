import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupQuestionIntegration } from "./helpers/setupQuestionIntegration";

describe("Testes de integração de questões", () => {
    const context = setupQuestionIntegration();

    test("deve excluir a questão, preservar o quiz e registrar o log", async () => {
        const quiz = await context.createQuiz();
        const question = await context.createQuestion(quiz.id);
        const response = await app.inject({
            method: "DELETE",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });
        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toBeNull();
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toEqual(quiz);
        const logs = await prisma.logs.findMany({
            where: { user_id: context.teacherId, action: "EXCLUSAO_QUESTAO", description: { contains: `questão de ID ${question.id} do quiz` } }
        });
        expect(logs).toHaveLength(1);
    });

    test("deve remover as questões ao excluir o quiz", async () => {
        const quiz = await context.createQuiz();
        const question = await context.createQuestion(quiz.id);
        const response = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });
        expect(response.statusCode).toBe(204);
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toBeNull();
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toBeNull();
        expect(await prisma.conteudo.findUnique({ where: { id: quiz.conteudo_id } })).not.toBeNull();
    });
});
