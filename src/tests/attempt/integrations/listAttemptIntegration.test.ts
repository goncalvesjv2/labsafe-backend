import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupAttemptIntegration } from "./helpers/setupAttemptIntegration";

describe("Testes de integração de tentativas", () => {
    const context = setupAttemptIntegration();

    test("deve permitir que o criador do quiz consulte uma tentativa com suas respostas", async () => {
        const { quiz, correctAnswers } = await context.createQuiz();
        const submitted = await context.sendAttempt(quiz.id, correctAnswers);
        expect(submitted.statusCode).toBe(201);
        const attemptId = submitted.json().attempt.id;
        const response = await app.inject({
            method: "GET",
            url: `/api/attempts/${attemptId}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.id).toBe(attemptId);
        expect(body.studentId).toBe(context.studentId);
        expect(body.studentName).toBe("Aluno das Tentativas");
        expect(body.answers).toHaveLength(3);

        for (const answer of correctAnswers) {
            expect(body.answers).toContainEqual({ id: expect.any(Number), attemptId, questionId: answer.questionId, alternativeId: answer.alternativeId });
        }
    });

    test("deve listar somente as tentativas do quiz selecionado com o nome de cada aluno", async () => {
        const firstQuiz = await context.createQuiz();
        const secondQuiz = await context.createQuiz();
        const first = await context.sendAttempt(firstQuiz.quiz.id, firstQuiz.correctAnswers);
        const second = await context.sendAttempt(secondQuiz.quiz.id, secondQuiz.correctAnswers);
        const anotherStudent = await context.sendAttempt(firstQuiz.quiz.id, firstQuiz.correctAnswers, context.otherStudentToken);
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(anotherStudent.statusCode).toBe(201);
        const response = await app.inject({
            method: "GET",
            url: `/api/quizzes/${firstQuiz.quiz.id}/attempts`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual([
            { ...first.json().attempt, studentName: "Aluno das Tentativas" },
            { ...anotherStudent.json().attempt, studentName: "Outro Aluno" }
        ]);
    });

    test("deve contar somente as tentativas do aluno no quiz selecionado", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await context.createQuiz();
        const anotherQuiz = await context.createQuiz();
        const first = await context.sendAttempt(quiz.id, incorrectAnswers);
        const second = await context.sendAttempt(quiz.id, correctAnswers);
        const anotherStudent = await context.sendAttempt(quiz.id, correctAnswers, context.otherStudentToken);
        const anotherQuizAttempt = await context.sendAttempt(anotherQuiz.quiz.id, anotherQuiz.correctAnswers);
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(anotherStudent.statusCode).toBe(201);
        expect(anotherQuizAttempt.statusCode).toBe(201);
        const response = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}/students/${context.studentId}/attempts`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            studentId: context.studentId,
            studentName: "Aluno das Tentativas",
            quizId: quiz.id,
            totalAttempts: 2,
            attempts: [
                { ...first.json().attempt, studentName: "Aluno das Tentativas" },
                { ...second.json().attempt, studentName: "Aluno das Tentativas" }
            ]
        });
    });

    test("deve retornar lista vazia e contagem zero quando não existem tentativas", async () => {
        const { quiz } = await context.createQuiz();
        const list = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}/attempts`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });
        const history = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}/students/${context.studentId}/attempts`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });

        expect(list.statusCode).toBe(200);
        expect(list.json()).toEqual([]);
        expect(history.statusCode).toBe(200);
        expect(history.json()).toEqual({ studentId: context.studentId, studentName: "Aluno das Tentativas", quizId: quiz.id, totalAttempts: 0, attempts: [] });
    });

    test("deve rejeitar IDs inválidos nas consultas", async () => {
        const urls = [
            "/api/attempts/abc",
            "/api/attempts/0",
            "/api/quizzes/-1/attempts",
            `/api/quizzes/1/students/1.5/attempts`,
            `/api/quizzes/abc/students/${context.studentId}/attempts`
        ];

        for (const url of urls) {
            const response = await app.inject({ method: "GET", url, headers: { authorization: `Bearer ${context.teacherToken}` } });
            expect(response.statusCode).toBe(400);
        }
    });

    test("deve informar quando a tentativa consultada não existe", async () => {
        const { quiz, correctAnswers } = await context.createQuiz();
        const submitted = await context.sendAttempt(quiz.id, correctAnswers);
        expect(submitted.statusCode).toBe(201);
        const attemptId = submitted.json().attempt.id;
        await prisma.attempt.delete({ where: { id: attemptId } });
        const response = await app.inject({
            method: "GET",
            url: `/api/attempts/${attemptId}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });

        expect(response.statusCode).toBe(404);
        expect(response.json().message).toBe("Tentativa não encontrada");
    });

    test("deve informar quando o quiz consultado não existe", async () => {
        const { quiz } = await context.createQuiz(0);
        await prisma.quiz.delete({ where: { id: quiz.id } });
        const response = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}/attempts`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });

        expect(response.statusCode).toBe(404);
        expect(response.json().message).toBe("Quiz não encontrado");
    });
});
