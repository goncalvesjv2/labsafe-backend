import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupAttemptIntegration } from "./helpers/setupAttemptIntegration";

describe("Testes de integração de tentativas", () => {
    const context = setupAttemptIntegration();

    test("deve permitir responder quando apenas outro aluno ou outro quiz possui aprovacao", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await context.createQuiz();
        const anotherQuiz = await context.createQuiz();
        expect((await context.sendAttempt(quiz.id, correctAnswers, context.otherStudentToken)).statusCode).toBe(201);
        expect((await context.sendAttempt(anotherQuiz.quiz.id, anotherQuiz.correctAnswers)).statusCode).toBe(201);

        const before = await app.inject({
            method: "GET",
            url: `/api/quizzes/${quiz.id}/result?studentId=${context.otherStudentId}`,
            headers: { authorization: `Bearer ${context.studentToken}` }
        });
        expect(before.statusCode).toBe(200);
        expect(before.json()).toEqual({ canAnswer: true, result: null });

        expect((await context.sendAttempt(quiz.id, incorrectAnswers)).statusCode).toBe(201);
        const after = await context.getResult(quiz.id);
        expect(after.statusCode).toBe(200);
        expect(after.json()).toEqual({ canAnswer: true, result: null });
    });

    test("deve salvar a tentativa, as respostas e o log quando o aluno acerta tudo", async () => {
        const { quiz, correctAnswers } = await context.createQuiz();
        const response = await context.sendAttempt(quiz.id, correctAnswers);

        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body).toEqual({
            attempt: { id: expect.any(Number), quizId: quiz.id, studentId: context.studentId, score: 100, approved: true, correctCount: 3, totalQuestions: 3, createdAt: expect.any(String) },
            totalQuestions: 3,
            correctCount: 3
        });

        const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: body.attempt.id } });
        expect(attempt.quiz_id).toBe(quiz.id);
        expect(attempt.student_id).toBe(context.studentId);
        expect(Number(attempt.score)).toBe(100);
        expect(attempt.correct_count).toBe(3);
        expect(attempt.total_questions).toBe(3);
        expect(attempt.approved).toBe(true);
        const answers = await prisma.answer.findMany({ where: { attempt_id: attempt.id } });
        expect(answers).toHaveLength(3);

        for (const answer of correctAnswers) {
            expect(answers).toContainEqual(expect.objectContaining({ question_id: answer.questionId, alternative_id: answer.alternativeId }));
        }

        expect(await prisma.logs.count({
            where: { user_id: context.studentId, action: "CADASTRO_TENTATIVA", description: { contains: `tentativa de ID ${attempt.id} ` } }
        })).toBe(1);
    });

    test("deve aprovar o aluno que acerta três de cinco questões", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await context.createQuiz(5);
        const answers = [correctAnswers[0], correctAnswers[1], correctAnswers[2], incorrectAnswers[3], incorrectAnswers[4]];
        const response = await context.sendAttempt(quiz.id, answers);

        expect(response.statusCode).toBe(201);
        expect(response.json().attempt.score).toBe(60);
        expect(response.json().attempt.approved).toBe(true);
        expect(response.json().correctCount).toBe(3);
    });

    test("deve reprovar e salvar nota com uma casa decimal abaixo de 60 por cento", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await context.createQuiz();
        const response = await context.sendAttempt(quiz.id, [correctAnswers[0], incorrectAnswers[1], incorrectAnswers[2]]);

        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body.attempt.score).toBe(33.3);
        expect(body.attempt.approved).toBe(false);
        expect(body.correctCount).toBe(1);
        const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: body.attempt.id } });
        expect(Number(attempt.score)).toBe(33.3);
        expect(attempt.approved).toBe(false);
    });

    test("deve arredondar a nota para 66.7 ao acertar duas de três questões", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await context.createQuiz();
        const response = await context.sendAttempt(quiz.id, [correctAnswers[0], correctAnswers[1], incorrectAnswers[2]]);
        expect(response.statusCode).toBe(201);
        expect(response.json().attempt.score).toBe(66.7);
        expect(response.json().attempt.approved).toBe(true);
    });

    test("deve criar outra tentativa após o aluno reprovar", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await context.createQuiz();
        const first = await context.sendAttempt(quiz.id, incorrectAnswers);
        const second = await context.sendAttempt(quiz.id, correctAnswers);
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(first.json().attempt.score).toBe(0);
        expect(first.json().attempt.approved).toBe(false);
        expect(second.json().attempt.score).toBe(100);
        expect(second.json().attempt.approved).toBe(true);
        expect(first.json().attempt.id).not.toBe(second.json().attempt.id);
        expect(await prisma.attempt.count({ where: { quiz_id: quiz.id, student_id: context.studentId } })).toBe(2);
        expect(await prisma.answer.count({ where: { attempt: { quiz_id: quiz.id } } })).toBe(6);
    });

    test("deve bloquear novas respostas apos a aprovacao sem gravar tentativa, respostas ou log de sucesso", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await context.createQuiz();
        expect((await context.sendAttempt(quiz.id, correctAnswers)).statusCode).toBe(201);

        for (const answers of [correctAnswers, incorrectAnswers]) {
            const response = await context.sendAttempt(quiz.id, answers);
            expect(response.statusCode).toBe(400);
            expect(response.json().message).toBe("Você já foi aprovado neste quiz");
        }

        expect(await prisma.attempt.count({ where: { quiz_id: quiz.id, student_id: context.studentId } })).toBe(1);
        expect(await prisma.answer.count({ where: { attempt: { quiz_id: quiz.id } } })).toBe(3);
        expect(await prisma.logs.count({ where: { user_id: context.studentId, action: "CADASTRO_TENTATIVA", description: { endsWith: `no quiz de ID ${quiz.id}` } } })).toBe(1);
    });

    test("deve bloquear novos envios mesmo quando a aprovacao antiga nao possui contagens", async () => {
        const { quiz, correctAnswers } = await context.createQuiz();
        await prisma.attempt.create({ data: { quiz_id: quiz.id, student_id: context.studentId, score: 100, approved: true } });

        const response = await context.sendAttempt(quiz.id, correctAnswers);
        expect(response.statusCode).toBe(400);
        expect(response.json().message).toBe("Você já foi aprovado neste quiz");
        expect(await prisma.attempt.count({ where: { quiz_id: quiz.id, student_id: context.studentId } })).toBe(1);
        expect(await prisma.answer.count({ where: { attempt: { quiz_id: quiz.id } } })).toBe(0);
    });

    test("deve aceitar um quiz com dez questões", async () => {
        const { quiz, correctAnswers } = await context.createQuiz(10);
        const response = await context.sendAttempt(quiz.id, correctAnswers);
        expect(response.statusCode).toBe(201);
        expect(response.json().totalQuestions).toBe(10);
        expect(response.json().correctCount).toBe(10);
        expect(response.json().attempt.score).toBe(100);
        expect(await prisma.answer.count({ where: { attempt_id: response.json().attempt.id } })).toBe(10);
    });

    test("deve usar o aluno autenticado e calcular a nota mesmo com campos extras no corpo", async () => {
        const { quiz, incorrectAnswers } = await context.createQuiz();
        const response = await app.inject({
            method: "POST",
            url: "/api/attempts",
            headers: { authorization: `Bearer ${context.studentToken}` },
            payload: { quizId: quiz.id, answers: incorrectAnswers, studentId: context.otherStudentId, score: 100, approved: true }
        });

        expect(response.statusCode).toBe(201);
        expect(response.json().attempt.studentId).toBe(context.studentId);
        expect(response.json().attempt.score).toBe(0);
        expect(response.json().attempt.approved).toBe(false);
        expect(await prisma.attempt.count({ where: { quiz_id: quiz.id, student_id: context.otherStudentId } })).toBe(0);
    });
});
