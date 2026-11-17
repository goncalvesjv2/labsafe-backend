import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupAlternativeIntegration } from "./helpers/setupAlternativeIntegration";

describe("Testes de integração de alternativas", () => {
    const context = setupAlternativeIntegration();

    test("deve cadastrar duas alternativas, remover espaços e registrar os logs", async () => {
        const question = await context.createQuestion();
        const response = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: [
                { questionId: question.id, text: "  Óculos de proteção  ", correct: true, id: 999, teacherId: context.otherTeacherId },
                { questionId: question.id, text: "Luvas", correct: false }
            ]
        });

        expect(response.statusCode).toBe(201);
        expect(response.json()).toHaveLength(2);
        expect(response.json()).toEqual(expect.arrayContaining([
            { id: expect.any(Number), questionId: question.id, text: "Óculos de proteção", correct: true },
            { id: expect.any(Number), questionId: question.id, text: "Luvas", correct: false }
        ]));
        const saved = await prisma.alternative.findMany({ where: { question_id: question.id } });
        expect(saved).toHaveLength(2);
        expect(saved).toEqual(expect.arrayContaining([
            { id: expect.any(Number), question_id: question.id, text: "Óculos de proteção", correct: true },
            { id: expect.any(Number), question_id: question.id, text: "Luvas", correct: false }
        ]));
        expect(await prisma.logs.count({
            where: { user_id: context.teacherId, action: "CADASTRO_ALTERNATIVA", description: { endsWith: `na questão de ID ${question.id}` } }
        })).toBe(2);
    });

    test("deve permitir adicionar a terceira e a quarta alternativa uma por vez", async () => {
        const question = await context.createQuestion();
        await context.createAlternatives(question.id);

        for (const text of ["Jaleco", "Máscara"]) {
            const response = await app.inject({
                method: "POST",
                url: "/api/alternatives",
                headers: { authorization: `Bearer ${context.teacherToken}` },
                payload: [{ questionId: question.id, text, correct: false }]
            });

            expect(response.statusCode).toBe(201);
            expect(response.json()).toEqual([{ id: expect.any(Number), questionId: question.id, text, correct: false }]);
        }

        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(4);
        expect(await prisma.alternative.count({ where: { question_id: question.id, correct: true } })).toBe(1);
    });

    test("deve impedir o cadastro de apenas uma alternativa em uma questão vazia", async () => {
        const question = await context.createQuestion();
        const response = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: [{ questionId: question.id, text: "Óculos de proteção", correct: true }]
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("A questão deve ter no mínimo 2 alternativas");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(0);
        expect(await prisma.logs.count({
            where: { user_id: context.teacherId, action: "CADASTRO_ALTERNATIVA", description: { endsWith: `na questão de ID ${question.id}` } }
        })).toBe(0);
    });

    test("deve impedir uma quinta alternativa", async () => {
        const question = await context.createQuestion();
        await context.createAlternatives(question.id);
        await prisma.alternative.createMany({
            data: [
                { question_id: question.id, text: "Jaleco", correct: false },
                { question_id: question.id, text: "Máscara", correct: false }
            ]
        });
        const response = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: [{ questionId: question.id, text: "Calçado fechado", correct: false }]
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("A questão pode ter no máximo 4 alternativas");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(4);
    });

    test("deve rejeitar o cadastro sem correta ou com duas corretas", async () => {
        const question = await context.createQuestion();
        const withoutCorrect = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: [
                { questionId: question.id, text: "Óculos de proteção", correct: false },
                { questionId: question.id, text: "Luvas", correct: false }
            ]
        });
        const twoCorrect = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: [
                { questionId: question.id, text: "Óculos de proteção", correct: true },
                { questionId: question.id, text: "Luvas", correct: true }
            ]
        });

        expect(withoutCorrect.statusCode).toBe(400);
        expect(twoCorrect.statusCode).toBe(400);
        expect(withoutCorrect.json().message).toBe("A questão deve ter exatamente 1 alternativa correta");
        expect(twoCorrect.json().message).toBe("A questão deve ter exatamente 1 alternativa correta");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(0);
    });

    test("deve impedir outra correta quando a questão já possui uma", async () => {
        const question = await context.createQuestion();
        await context.createAlternatives(question.id);
        const response = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: [{ questionId: question.id, text: "Jaleco", correct: true }]
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("A questão deve ter exatamente 1 alternativa correta");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(2);
        expect(await prisma.alternative.count({ where: { question_id: question.id, correct: true } })).toBe(1);
    });

    test("deve rejeitar alternativas de questões diferentes na mesma requisição", async () => {
        const question = await context.createQuestion();
        const otherQuestion = await context.createQuestion();
        const response = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: [
                { questionId: question.id, text: "Óculos de proteção", correct: true },
                { questionId: otherQuestion.id, text: "Luvas", correct: false }
            ]
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("As alternativas devem pertencer à mesma questão");
        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(0);
        expect(await prisma.alternative.count({ where: { question_id: otherQuestion.id } })).toBe(0);
    });

    test("deve rejeitar corpos inválidos no cadastro", async () => {
        const question = await context.createQuestion();
        const invalidBodies = [
            {},
            [],
            [{ text: "Luvas", correct: false }],
            [{ questionId: String(question.id), text: "Luvas", correct: false }],
            [{ questionId: question.id, text: "   ", correct: false }],
            [{ questionId: question.id, text: "Luvas", correct: "false" }],
            [{ questionId: question.id, text: "Luvas" }]
        ];

        for (const payload of invalidBodies) {
            const response = await app.inject({
                method: "POST",
                url: "/api/alternatives",
                headers: { authorization: `Bearer ${context.teacherToken}` },
                payload
            });

            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Dados inválidos");
        }

        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(0);
    });
});
