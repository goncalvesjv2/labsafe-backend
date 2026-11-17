import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupAlternativeIntegration } from "./helpers/setupAlternativeIntegration";

describe("Testes de integração de alternativas", () => {
    const context = setupAlternativeIntegration();

    test("deve rejeitar IDs inválidos nas rotas", async () => {
        for (const id of ["0", "-1", "1.5", "abc"]) {
            const headers = { authorization: `Bearer ${context.teacherToken}` };
            const byId = await app.inject({ method: "GET", url: `/api/alternatives/${id}`, headers });
            const byQuestion = await app.inject({ method: "GET", url: `/api/questions/${id}/alternatives`, headers });
            const patch = await app.inject({ method: "PATCH", url: `/api/alternatives/${id}`, headers, payload: { text: "Luvas" } });
            const change = await app.inject({ method: "PATCH", url: `/api/alternatives/${id}/correct`, headers });
            const remove = await app.inject({ method: "DELETE", url: `/api/alternatives/${id}`, headers });

            expect(byId.statusCode).toBe(400);
            expect(byQuestion.statusCode).toBe(400);
            expect(patch.statusCode).toBe(400);
            expect(change.statusCode).toBe(400);
            expect(remove.statusCode).toBe(400);
            expect(byId.json().message).toBe("ID inválido");
            expect(byQuestion.json().message).toBe("ID inválido");
            expect(patch.json().message).toBe("ID inválido");
            expect(change.json().message).toBe("ID inválido");
            expect(remove.json().message).toBe("ID inválido");
        }
    });

    test("deve tratar uma alternativa e uma questão inexistentes", async () => {
        const question = await context.createQuestion();
        const { incorrectAlternative } = await context.createAlternatives(question.id);
        await prisma.question.delete({ where: { id: question.id } });
        const headers = { authorization: `Bearer ${context.teacherToken}` };
        const byId = await app.inject({ method: "GET", url: `/api/alternatives/${incorrectAlternative.id}`, headers });
        const byQuestion = await app.inject({ method: "GET", url: `/api/questions/${question.id}/alternatives`, headers });
        const post = await app.inject({
            method: "POST",
            url: "/api/alternatives",
            headers,
            payload: [
                { questionId: question.id, text: "Óculos de proteção", correct: true },
                { questionId: question.id, text: "Luvas", correct: false }
            ]
        });
        const patch = await app.inject({ method: "PATCH", url: `/api/alternatives/${incorrectAlternative.id}`, headers, payload: { text: "Luvas" } });
        const change = await app.inject({ method: "PATCH", url: `/api/alternatives/${incorrectAlternative.id}/correct`, headers });
        const remove = await app.inject({ method: "DELETE", url: `/api/alternatives/${incorrectAlternative.id}`, headers });

        expect(byId.statusCode).toBe(404);
        expect(byQuestion.statusCode).toBe(404);
        expect(post.statusCode).toBe(400);
        expect(patch.statusCode).toBe(400);
        expect(change.statusCode).toBe(400);
        expect(remove.statusCode).toBe(500);
        expect(byId.json().message).toBe("Alternativa não encontrada");
        expect(byQuestion.json().message).toBe("Questão não encontrada");
        expect(post.json().message).toBe("Questão não encontrada");
        expect(patch.json().message).toBe("Alternativa não encontrada");
        expect(change.json().message).toBe("Alternativa não encontrada");
        expect(remove.json().message).toBe("Alternativa não encontrada");
    });
});
