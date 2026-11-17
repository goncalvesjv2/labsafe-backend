import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupAlternativeIntegration } from "./helpers/setupAlternativeIntegration";

describe("Testes de integração de alternativas", () => {
    const context = setupAlternativeIntegration();

    test("deve excluir uma incorreta, manter duas alternativas e registrar o log", async () => {
        const question = await context.createQuestion();
        const { correctAlternative, incorrectAlternative } = await context.createAlternatives(question.id);
        await prisma.alternative.create({ data: { question_id: question.id, text: "Jaleco", correct: false } });
        const response = await app.inject({
            method: "DELETE",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });

        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toBeNull();
        expect(await prisma.alternative.findUnique({ where: { id: correctAlternative.id } })).toEqual(correctAlternative);
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(2);
        expect(await prisma.logs.count({
            where: { user_id: context.teacherId, action: "EXCLUSAO_ALTERNATIVA", description: { contains: `alternativa de ID ${incorrectAlternative.id} da questão` } }
        })).toBe(1);
    });

    test("deve impedir uma exclusão que deixe menos de duas alternativas", async () => {
        const question = await context.createQuestion();
        const { incorrectAlternative } = await context.createAlternatives(question.id);
        const response = await app.inject({
            method: "DELETE",
            url: `/api/alternatives/${incorrectAlternative.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });

        expect(response.statusCode).toBe(500);
        expect(response.json().message).toBe("A questão deve ter no mínimo 2 alternativas");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(2);
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual(incorrectAlternative);
        expect(await prisma.logs.count({
            where: { user_id: context.teacherId, action: "EXCLUSAO_ALTERNATIVA", description: { contains: `alternativa de ID ${incorrectAlternative.id} da questão` } }
        })).toBe(0);
    });

    test("deve impedir a exclusão da única correta", async () => {
        const question = await context.createQuestion();
        const { correctAlternative } = await context.createAlternatives(question.id);
        await prisma.alternative.create({ data: { question_id: question.id, text: "Jaleco", correct: false } });
        const response = await app.inject({
            method: "DELETE",
            url: `/api/alternatives/${correctAlternative.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });

        expect(response.statusCode).toBe(500);
        expect(response.json().message).toBe("A questão deve manter exatamente 1 alternativa correta");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(3);
        expect(await prisma.alternative.findUnique({ where: { id: correctAlternative.id } })).toEqual(correctAlternative);
    });

    test("deve remover as alternativas ao excluir a questão", async () => {
        const question = await context.createQuestion();
        await context.createAlternatives(question.id);
        const response = await app.inject({
            method: "DELETE",
            url: `/api/questions/${question.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });

        expect(response.statusCode).toBe(204);
        expect(await prisma.question.findUnique({ where: { id: question.id } })).toBeNull();
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(0);
    });
});
