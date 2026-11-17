import "dotenv/config";
import { describe, expect, test } from "@jest/globals";
import { app } from "../../../app";
import { prisma } from "../../../database/prisma";
import { setupAttemptIntegration } from "./helpers/setupAttemptIntegration";

describe("Testes de integração de tentativas", () => {
    const context = setupAttemptIntegration();

    test("deve excluir o quiz com suas questões, alternativas, tentativas e respostas", async () => {
        const { quiz, correctAnswers, incorrectAnswers } = await context.createQuiz();
        const anotherQuiz = await context.createQuiz(1);
        const first = await context.sendAttempt(quiz.id, incorrectAnswers);
        const second = await context.sendAttempt(quiz.id, correctAnswers);
        const anotherStudent = await context.sendAttempt(quiz.id, correctAnswers, context.otherStudentToken);
        const anotherQuizAttempt = await context.sendAttempt(anotherQuiz.quiz.id, anotherQuiz.correctAnswers);
        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);
        expect(anotherStudent.statusCode).toBe(201);
        expect(anotherQuizAttempt.statusCode).toBe(201);

        const questionIds = correctAnswers.map((answer) => answer.questionId);
        const alternatives = await prisma.alternative.findMany({ where: { question_id: { in: questionIds } } });
        const alternativeIds = alternatives.map((alternative) => alternative.id);
        const attemptIds = [first.json().attempt.id, second.json().attempt.id, anotherStudent.json().attempt.id];
        expect(alternatives).toHaveLength(6);
        expect(await prisma.answer.count({ where: { attempt_id: { in: attemptIds } } })).toBe(9);

        const response = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.teacherToken}` }
        });

        expect(response.statusCode).toBe(204);
        expect(response.body).toBe("");
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).toBeNull();
        expect(await prisma.question.count({ where: { id: { in: questionIds } } })).toBe(0);
        expect(await prisma.alternative.count({ where: { id: { in: alternativeIds } } })).toBe(0);
        expect(await prisma.attempt.count({ where: { id: { in: attemptIds } } })).toBe(0);
        expect(await prisma.answer.count({ where: { attempt_id: { in: attemptIds } } })).toBe(0);

        expect(await prisma.conteudo.findUnique({ where: { id: quiz.conteudo_id } })).not.toBeNull();
        expect(await prisma.quiz.findUnique({ where: { id: anotherQuiz.quiz.id } })).not.toBeNull();
        expect(await prisma.question.count({ where: { quiz_id: anotherQuiz.quiz.id } })).toBe(1);
        expect(await prisma.alternative.count({ where: { question_id: anotherQuiz.correctAnswers[0].questionId } })).toBe(2);
        expect(await prisma.attempt.findUnique({ where: { id: anotherQuizAttempt.json().attempt.id } })).not.toBeNull();
        expect(await prisma.answer.count({ where: { attempt_id: anotherQuizAttempt.json().attempt.id } })).toBe(1);
        expect(await prisma.logs.count({
            where: { user_id: context.teacherId, action: "EXCLUSAO_QUIZ", description: { contains: `quiz de ID ${quiz.id} ` } }
        })).toBe(1);
    });

    test("deve impedir que outro professor exclua um quiz e suas tentativas", async () => {
        const { quiz, correctAnswers } = await context.createQuiz();
        const submitted = await context.sendAttempt(quiz.id, correctAnswers);
        expect(submitted.statusCode).toBe(201);

        const response = await app.inject({
            method: "DELETE",
            url: `/api/quizzes/${quiz.id}`,
            headers: { authorization: `Bearer ${context.otherTeacherToken}` }
        });

        expect(response.statusCode).toBe(500);
        expect(response.json().message).toBe("Você só pode excluir seus próprios quizzes");
        expect(await prisma.quiz.findUnique({ where: { id: quiz.id } })).not.toBeNull();
        expect(await prisma.question.count({ where: { quiz_id: quiz.id } })).toBe(3);
        expect(await prisma.alternative.count({ where: { question: { quiz_id: quiz.id } } })).toBe(6);
        expect(await prisma.attempt.findUnique({ where: { id: submitted.json().attempt.id } })).not.toBeNull();
        expect(await prisma.answer.count({ where: { attempt_id: submitted.json().attempt.id } })).toBe(3);
    });
});
