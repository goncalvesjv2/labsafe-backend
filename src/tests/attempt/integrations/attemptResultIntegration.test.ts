import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { prisma } from "../../../database/prisma";
import { setupAttemptIntegration } from "./helpers/setupAttemptIntegration";

describe("Testes de integração de tentativas", () => {
    const context = setupAttemptIntegration();

    test("deve retornar o resultado aprovado com os totais originais apos alterar o quiz", async () => {
        const { quiz, correctAnswers } = await context.createQuiz();
        const submitted = await context.sendAttempt(quiz.id, correctAnswers);
        expect(submitted.statusCode).toBe(201);
        await prisma.question.create({ data: { quiz_id: quiz.id, statement: "Nova questao" } });

        const response = await context.getResult(quiz.id);
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ canAnswer: false, result: submitted.json() });
    });

    test("deve selecionar a aprovacao mais recente com desempate pelo ID e ignorar reprovacao posterior", async () => {
        const { quiz } = await context.createQuiz();
        const base = { quiz_id: quiz.id, student_id: context.studentId, total_questions: 3 };
        await prisma.attempt.create({ data: { ...base, score: 66.7, approved: true, correct_count: 2, created_at: new Date("2026-01-02T12:00:00Z") } });
        const expected = await prisma.attempt.create({ data: { ...base, score: 100, approved: true, correct_count: 3, created_at: new Date("2026-01-02T12:00:00Z") } });
        await prisma.attempt.create({ data: { ...base, score: 66.7, approved: true, correct_count: 2, created_at: new Date("2026-01-01T12:00:00Z") } });
        await prisma.attempt.create({ data: { ...base, score: 0, approved: false, correct_count: 0, created_at: new Date("2026-01-03T12:00:00Z") } });

        const response = await context.getResult(quiz.id);
        expect(response.statusCode).toBe(200);
        expect(response.json().canAnswer).toBe(false);
        expect(response.json().result.attempt.id).toBe(expected.id);
        expect(response.json().result.correctCount).toBe(3);
        expect(response.json().result.totalQuestions).toBe(3);
    });

    test("deve preservar aprovacao antiga com contagens desconhecidas como null", async () => {
        const { quiz } = await context.createQuiz();
        const legacy = await prisma.attempt.create({ data: { quiz_id: quiz.id, student_id: context.studentId, score: 100, approved: true } });

        const response = await context.getResult(quiz.id);
        expect(response.statusCode).toBe(200);
        expect(response.json().canAnswer).toBe(false);
        expect(response.json().result.attempt.id).toBe(legacy.id);
        expect(response.json().result.correctCount).toBeNull();
        expect(response.json().result.totalQuestions).toBeNull();
    });

    test("deve rejeitar IDs invalidos ao consultar o resultado", async () => {
        for (const id of ["abc", "0", "-1", "1.5", "9007199254740992"]) {
            const response = await context.getResult(id);
            expect(response.statusCode).toBe(400);
        }
    });

    test("deve retornar 404 ao consultar o resultado de um quiz inexistente", async () => {
        const { quiz } = await context.createQuiz(0);
        await prisma.quiz.delete({ where: { id: quiz.id } });
        const response = await context.getResult(quiz.id);
        expect(response.statusCode).toBe(404);
        expect(response.json().message).toBe("Quiz não encontrado");
    });

    test("deve restringir a consulta do proprio resultado aos alunos", async () => {
        const { quiz } = await context.createQuiz();
        for (const token of [context.teacherToken, context.adminToken]) {
            const response = await context.getResult(quiz.id, token);
            expect(response.statusCode).toBe(403);
        }
    });
});
