import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupAlternativeIntegration } from "./helpers/setupAlternativeIntegration";

describe("Testes de integração de alternativas", () => {
    const context = setupAlternativeIntegration();

    test("deve trocar a correta sem alterar as alternativas de outra questão", async () => {
        const question = await context.createQuestion();
        const { correctAlternative, incorrectAlternative } = await context.createAlternatives(question.id);
        const otherQuestion = await context.createQuestion();
        const otherAlternatives = await context.createAlternatives(otherQuestion.id);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}/correct`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: incorrectAlternative.id, questionId: question.id, text: incorrectAlternative.text, correct: true });
        expect(await prisma.alternative.findUnique({ where: { id: correctAlternative.id } })).toEqual({ ...correctAlternative, correct: false });
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual({ ...incorrectAlternative, correct: true });
        expect(await prisma.alternative.count({ where: { question_id: question.id, correct: true } })).toBe(1);
        expect(await prisma.alternative.findUnique({ where: { id: otherAlternatives.correctAlternative.id } })).toEqual(otherAlternatives.correctAlternative);
        expect(await prisma.logs.count({
            where: { user_id: context.teacherId, action: "ALTERACAO_ALTERNATIVA_CORRETA", description: { endsWith: `para a alternativa de ID ${incorrectAlternative.id}` } }
        })).toBe(1);
    });
});
