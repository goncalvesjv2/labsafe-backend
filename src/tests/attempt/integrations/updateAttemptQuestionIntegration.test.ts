import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupAttemptIntegration } from "./helpers/setupAttemptIntegration";

describe("Testes de integração de tentativas", () => {
    const context = setupAttemptIntegration();

    test("deve manter uma questão respondida no quiz original durante a edição", async () => {
        const { quiz, correctAnswers } = await context.createQuiz(1);
        const anotherQuiz = await context.createQuiz(0);
        const submitted = await context.sendAttempt(quiz.id, correctAnswers);
        expect(submitted.statusCode).toBe(201);
        const questionId = correctAnswers[0].questionId;

        const transfer = await app.inject({
            method: "PATCH",
            url: `/api/questions/${questionId}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { quizId: anotherQuiz.quiz.id }
        });
        expect(transfer.statusCode).toBe(400);

        const edit = await app.inject({
            method: "PATCH",
            url: `/api/questions/${questionId}`,
            headers: { authorization: `Bearer ${context.teacherToken}` },
            payload: { quizId: anotherQuiz.quiz.id, statement: "Enunciado atualizado" }
        });
        expect(edit.statusCode).toBe(200);
        expect(edit.json()).toEqual({ id: questionId, quizId: quiz.id, statement: "Enunciado atualizado" });

        const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
        const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: submitted.json().attempt.id } });
        const answers = await prisma.answer.findMany({ where: { attempt_id: attempt.id } });
        expect(question.quiz_id).toBe(quiz.id);
        expect(attempt.quiz_id).toBe(quiz.id);
        expect(Number(attempt.score)).toBe(100);
        expect(answers).toHaveLength(1);
        expect(answers[0].question_id).toBe(questionId);
        expect(answers[0].alternative_id).toBe(correctAnswers[0].alternativeId);
        expect(await prisma.question.count({ where: { quiz_id: anotherQuiz.quiz.id } })).toBe(0);
    });
});
