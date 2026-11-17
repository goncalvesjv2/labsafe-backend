import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { UserRole } from "../../../utils/user";
import { setupAlternativeIntegration } from "./helpers/setupAlternativeIntegration";

describe("Testes de integração de alternativas", () => {
    const context = setupAlternativeIntegration();

    test("deve rejeitar todas as rotas sem token, com token inválido ou expirado", async () => {
        const question = await context.createQuestion();
        const { incorrectAlternative } = await context.createAlternatives(question.id);
        const expiredToken = app.jwt.sign({ sub: context.teacherId, role: UserRole.PROFESSOR }, { expiresIn: -1 });

        for (const token of ["", "token-invalido", expiredToken]) {
            const headers = token ? { authorization: `Bearer ${token}` } : {};
            const list = await app.inject({ method: "GET", url: "/api/alternatives", headers });
            const byId = await app.inject({ method: "GET", url: `/api/alternatives/${incorrectAlternative.id}`, headers });
            const byQuestion = await app.inject({ method: "GET", url: `/api/questions/${question.id}/alternatives`, headers });
            const post = await app.inject({
                method: "POST",
                url: "/api/alternatives",
                headers,
                payload: [{ questionId: question.id, text: "Jaleco", correct: false }]
            });
            const patch = await app.inject({
                method: "PATCH",
                url: `/api/alternatives/${incorrectAlternative.id}`,
                headers,
                payload: { text: "Alteração indevida" }
            });
            const change = await app.inject({ method: "PATCH", url: `/api/alternatives/${incorrectAlternative.id}/correct`, headers });
            const remove = await app.inject({ method: "DELETE", url: `/api/alternatives/${incorrectAlternative.id}`, headers });

            expect(list.statusCode).toBe(401);
            expect(byId.statusCode).toBe(401);
            expect(byQuestion.statusCode).toBe(401);
            expect(post.statusCode).toBe(401);
            expect(patch.statusCode).toBe(401);
            expect(change.statusCode).toBe(401);
            expect(remove.statusCode).toBe(401);
        }

        expect(await prisma.alternative.count({ where: { question_id: question.id } })).toBe(2);
        expect(await prisma.alternative.findUnique({ where: { id: incorrectAlternative.id } })).toEqual(incorrectAlternative);
    });
});
