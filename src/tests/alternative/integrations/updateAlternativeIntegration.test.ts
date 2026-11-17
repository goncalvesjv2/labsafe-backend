import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupAlternativeIntegration } from "./helpers/setupAlternativeIntegration";

describe("Testes de integração de alternativas", () => {
    const context = setupAlternativeIntegration();

    test("deve atualizar somente o texto e registrar o log", async () => {
        const question = await context.createQuestion();
        const otherQuestion = await context.createQuestion();
        const { incorrectAlternative } = await context.createAlternatives(question.id);
        const response = await app.inject({
            method: "PATCH",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { text: "  Luvas de proteção  ", correct: true, questionId: otherQuestion.id }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: incorrectAlternative.id, questionId: question.id, text: "Luvas de proteção", correct: false });
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual({ ...incorrectAlternative, text: "Luvas de proteção" });
        expect(await prisma.logs.count({
            where: { user_id: context.teacherId, action: "ALTERACAO_ALTERNATIVA", description: { contains: `alternativa de ID ${incorrectAlternative.id} na questão` } }
        })).toBe(1);
    });

    test("deve rejeitar corpos inválidos na atualização", async () => {
        const question = await context.createQuestion();
        const { incorrectAlternative } = await context.createAlternatives(question.id);

        for (const payload of [{}, { text: "   " }, { text: 123 }, { correct: true }, { questionId: question.id }]) {
            const response = await app.inject({
                method: "PATCH",
                url: `/api/alternatives/${incorrectAlternative.id}`,
                headers: { authorization: `Bearer ${context.teacherToken}` },
                payload
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Dados inválidos");
        }

        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual(incorrectAlternative);
    });
});
