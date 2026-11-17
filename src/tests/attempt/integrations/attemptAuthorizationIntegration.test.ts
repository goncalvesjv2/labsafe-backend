import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { setupAttemptIntegration } from "./helpers/setupAttemptIntegration";

describe("Testes de integração de tentativas", () => {
    const context = setupAttemptIntegration();

    test("deve impedir envios por professores e administradores", async () => {
        const { quiz, correctAnswers } = await context.createQuiz();

        for (const token of [context.teacherToken, context.adminToken]) {
            const response = await context.sendAttempt(quiz.id, correctAnswers, token);
            expect(response.statusCode).toBe(403);
            expect(response.json().message).toBe("Somente alunos podem executar esta ação");
        }

        await context.expectNoAttempts(quiz.id);
    });

    test("deve impedir que alunos e administradores consultem tentativas", async () => {
        const { quiz, correctAnswers } = await context.createQuiz();
        const submitted = await context.sendAttempt(quiz.id, correctAnswers);
        expect(submitted.statusCode).toBe(201);
        const urls = [
            `/api/attempts/${submitted.json().attempt.id}`,
            `/api/quizzes/${quiz.id}/attempts`,
            `/api/quizzes/${quiz.id}/students/${context.studentId}/attempts`
        ];

        for (const token of [context.studentToken, context.adminToken]) {
            for (const url of urls) {
                const response = await app.inject({ method: "GET", url, headers: { authorization: `Bearer ${token}` } });
                expect(response.statusCode).toBe(403);
                expect(response.json().message).toBe("Somente professores podem executar esta ação");
            }
        }
    });

    test("deve impedir que outro professor consulte as tentativas do quiz", async () => {
        const { quiz, correctAnswers } = await context.createQuiz();
        const submitted = await context.sendAttempt(quiz.id, correctAnswers);
        expect(submitted.statusCode).toBe(201);
        const urls = [
            `/api/attempts/${submitted.json().attempt.id}`,
            `/api/quizzes/${quiz.id}/attempts`,
            `/api/quizzes/${quiz.id}/students/${context.studentId}/attempts`
        ];

        for (const url of urls) {
            const response = await app.inject({ method: "GET", url, headers: { authorization: `Bearer ${context.otherTeacherToken}` } });
            expect(response.statusCode).toBe(404);
            expect(response.json().message).toBe("Você pode somente consultar tentativas dos seus próprios quizzes");
        }
    });
});
