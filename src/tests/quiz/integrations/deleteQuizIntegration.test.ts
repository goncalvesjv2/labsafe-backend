import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupQuizIntegration } from "./helpers/setupQuizIntegration";

describe("Testes de integração do quiz", () => {
    const context = setupQuizIntegration();

    test("deve excluir o quiz, preservar o conteúdo e registrar o log", async () => {
        const { content, quiz } = await context.createQuizFixture();
        const response = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });
        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toBeNull();
        expect(await prisma.conteudo.findUnique({ where: { id: content.id } })).not.toBeNull();
        const logs = await prisma.logs.findMany({
            where: { user_id: context.teacherId, action: "EXCLUSAO_QUIZ", description: { contains: `quiz de ID ${quiz.id} ` } }
        });
        expect(logs).toHaveLength(1);
    }, 30000);
});
