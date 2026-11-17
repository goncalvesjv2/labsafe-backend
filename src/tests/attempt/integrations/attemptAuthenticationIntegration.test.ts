import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { setupAttemptIntegration } from "./helpers/setupAttemptIntegration";

describe("Testes de integração de tentativas", () => {
    const context = setupAttemptIntegration();

    test("deve rejeitar todas as rotas sem autenticação", async () => {
        const submitted = await app.inject({
            method: "POST",
            url: "/api/attempts",
            payload: { quizId: 1, answers: [{ questionId: 1, alternativeId: 1 }] }
        });
        expect(submitted.statusCode).toBe(401);

        for (const url of ["/api/attempts/1", "/api/quizzes/1/attempts", "/api/quizzes/1/students/1/attempts", "/api/quizzes/1/result"]) {
            const response = await app.inject({ method: "GET", url });
            expect(response.statusCode).toBe(401);
        }
    });

    test("deve rejeitar tokens inválidos ou expirados", async () => {
        const expiredToken = app.jwt.sign({ sub: context.studentId }, { expiresIn: -1 });

        for (const token of ["token-invalido", expiredToken]) {
            const submitted = await app.inject({
                method: "POST",
                url: "/api/attempts",
                headers: { authorization: `Bearer ${token}` },
                payload: { quizId: 1, answers: [{ questionId: 1, alternativeId: 1 }] }
            });
            expect(submitted.statusCode).toBe(401);

            for (const url of ["/api/attempts/1", "/api/quizzes/1/attempts", "/api/quizzes/1/students/1/attempts", "/api/quizzes/1/result"]) {
                const response = await app.inject({ method: "GET", url, headers: { authorization: `Bearer ${token}` } });
                expect(response.statusCode).toBe(401);
            }
        }
    });
});
